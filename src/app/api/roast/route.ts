import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchGitHubFile } from '@/lib/github';
import { fetchGitHubPR } from '@/lib/github-pr';
import { calculateScore, ScoreResult } from '@/lib/scoring';
import { randomUUID } from 'crypto';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const maxDuration = 60;

function generateSessionId() {
  return randomUUID().split('-')[0] + randomUUID().split('-')[1]; // Short-ish ID
}

function assignBadge(score: number): string {
  if (score >= 90) return '🏆 Code Master';
  if (score >= 70) return '💪 Getting There';
  if (score >= 40) return '🔥 Needs Work';
  return '💀 Please Refactor';
}

export async function POST(req: Request) {
  if (!PERPLEXITY_API_KEY) {
    return NextResponse.json({ success: false, error: 'Misconfigured: Missing Perplexity API Key' }, { status: 500 });
  }

  try {
    const {
      input_type = 'code',
      code: rawCode,
      language: rawLanguage,
      github_url,
      roastLevel = 'medium',
    } = await req.json();

    let codeToAnalyze = rawCode;
    let detectedLanguage = rawLanguage || 'javascript';
    let filename = 'snippet.js';
    let prRepo = '';

    // 1. Resolve Input
    if (input_type === 'github_file') {
      const fileData = await fetchGitHubFile(github_url);
      codeToAnalyze = fileData.code;
      detectedLanguage = fileData.language;
      filename = fileData.filename;
    } else if (input_type === 'github_pr') {
      const prData = await fetchGitHubPR(github_url);
      codeToAnalyze = prData.files.map((f) => `// File: ${f.filename}\n${f.code}`).join('\n\n');
      detectedLanguage = 'multi-file';
      filename = `PR #${prData.prNumber}: ${prData.title}`;
      prRepo = prData.repo;
    }

    if (!codeToAnalyze) {
      return NextResponse.json({ success: false, error: 'No code to analyze found.' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const session_id = generateSessionId();

    // 2. Create Review Record (Status: 'analyzing')
    const { data: review, error: dbError } = await supabase
      .from('code_reviews')
      .insert({
        session_id,
        code_snippet: codeToAnalyze,
        repo_url: prRepo,
        github_url: github_url, // For linking back
        language: detectedLanguage,
        roast_level: roastLevel,
        status: 'analyzing',
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    // 3. Analyze with Perplexity
    const roastPrompts = {
      gentle: 'Be constructive and encouraging with light humor.',
      medium: 'Be witty and sarcastic but helpful. Use clever analogies.',
      savage: 'Full Gordon Ramsay mode. Be brutally honest but educational.',
    };

    const roastStyle = roastPrompts[roastLevel as keyof typeof roastPrompts] || roastPrompts['medium'];

    const systemPrompt = `You are Code Critic, a developer reviewing code with personality.

ROAST STYLE: ${roastStyle}

Analyze the provided code for security, performance, complexity, logic, and style issues.

For EACH issue, you must decide which UI widget to render:
- SecurityBomb: Critical security vulnerabilities (SQL injection, XSS, secrets)
- SpaghettiMeter: Complex, unreadable code (high cyclomatic complexity)
- PerformanceTurtle: Performance issues (O(n²) loops, memory leaks)
- GenericRoast: Everything else

Return a JSON array with this EXACT structure:
[
  {
    "issue_type": "security|performance|complexity|logic|style",
    "severity": "critical|high|medium|low",
    "title": "Short punchy title (max 6 words)",
    "roast": "Your ${roastLevel} roast (1-2 sentences)",
    "explanation": "Technical explanation (2-3 sentences)",
    "line_number": number or null,
    "problematic_code": "The specific bad code snippet (if applicable)",
    "suggested_fix": "How to fix it",
    "widget_type": "SecurityBomb|SpaghettiMeter|PerformanceTurtle|GenericRoast",
    "widget_config": {
      // For SecurityBomb: {"severity_level": 1-10, "pulse_speed": "slow|medium|fast", "color": "#hex"}
      // For SpaghettiMeter: {"complexity": 0-100, "emoji": "🍝"}
      // For PerformanceTurtle: {"slowness_factor": 0-100, "animation_speed": "crawl|walk|run"}
      // For GenericRoast: {"emoji": "😱|🤦|💀", "color": "red|yellow|orange"}
    },
    "impact_score": 0-100
  }
]

Find 3-7 issues. Return ONLY the JSON array, no markdown formatting.`;

    const userMessage = `CODE TO REVIEW (${detectedLanguage}):
Context/File: ${filename}

\`\`\`${detectedLanguage}
${codeToAnalyze.slice(0, 15000)}
\`\`\``;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;

    let rawJson = aiContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let issues = [];
    try {
      issues = JSON.parse(rawJson);
    } catch (e) {
      console.error('JSON Parse Error', rawJson);
      // Fallback issue
      issues = [
        {
          title: 'AI Brain Freeze',
          severity: 'low',
          roast: 'I tried to roast you, but I roasted my own JSON parser instead.',
          explanation: 'The AI returned invalid JSON. It happens to the best of us.',
          issue_type: 'logic',
          widget_type: 'GenericRoast',
          widget_config: { emoji: '🤖', color: 'gray' },
          impact_score: 5,
        },
      ];
    }

    // 4. Calculate Score
    // We use the AI's impact_score to calculate the overall score
    const securityIssues = issues.filter((i: any) => i.issue_type === 'security');
    const performanceIssues = issues.filter((i: any) => i.issue_type === 'performance');
    const maintainabilityIssues = issues.filter((i: any) => i.issue_type === 'complexity' || i.issue_type === 'style');

    const securityScore = Math.max(
      0,
      100 - securityIssues.reduce((acc: number, i: any) => acc + (i.impact_score || 10), 0),
    );
    const performanceScore = Math.max(
      0,
      100 - performanceIssues.reduce((acc: number, i: any) => acc + (i.impact_score || 10), 0),
    );
    const maintainabilityScore = Math.max(
      0,
      100 - maintainabilityIssues.reduce((acc: number, i: any) => acc + (i.impact_score || 10), 0),
    );

    const overallScore = Math.round((securityScore + performanceScore + maintainabilityScore) / 3);
    const badge = assignBadge(overallScore);

    // 5. Update DB
    if (issues.length > 0) {
      const issuesToInsert = issues.map((issue: any) => ({
        review_id: review.id,
        impact_score: issue.impact_score || 0,
        ...issue,
      }));
      await supabase.from('code_issues').insert(issuesToInsert);
    }

    await supabase
      .from('code_reviews')
      .update({
        status: 'complete',
        overall_score: overallScore,
        security_score: securityScore,
        performance_score: performanceScore,
        maintainability_score: maintainabilityScore,
        badge: badge,
      })
      .eq('id', review.id);

    return NextResponse.json({
      success: true,
      session_id,
      status: 'complete',
      overall_score: overallScore,
      badge,
    });
  } catch (error: any) {
    console.error('Roast API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
