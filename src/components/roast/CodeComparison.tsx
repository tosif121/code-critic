import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface CodeComparisonProps {
  before: string;
  after: string;
  explanation: string;
}

export default function CodeComparison({ before, after, explanation }: CodeComparisonProps) {
  return (
    <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 my-4 shadow-xl">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <span className="text-sm font-mono text-purple-400 font-bold">Code Fix</span>
        <span className="text-xs text-slate-400">Before vs After</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700">
        <div className="p-4 bg-red-900/10">
          <div className="text-xs text-red-400 mb-2 font-bold uppercase tracking-wider">Original Bad Code</div>
          <pre className="text-xs text-red-200 overflow-x-auto font-mono whitespace-pre-wrap">{before}</pre>
        </div>

        <div className="p-4 bg-green-900/10 relative">
          <div className="text-xs text-green-400 mb-2 font-bold uppercase tracking-wider">Fixed Code</div>
          <pre className="text-xs text-green-200 overflow-x-auto font-mono whitespace-pre-wrap">{after}</pre>

          <div className="absolute top-1/2 -left-3 hidden md:block text-slate-500 bg-slate-900 rounded-full p-1 border border-slate-700">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 border-t border-slate-700">
        <p className="text-sm text-slate-300 italic">💡 {explanation}</p>
      </div>
    </div>
  );
}
