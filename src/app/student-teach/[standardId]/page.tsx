'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Standard {
  code: string;
  title: string;
}

export default function StudentTeachStandardPage() {
  const params = useParams();
  const standardId = params.standardId as string;

  const [standard, setStandard] = useState<Standard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStandard() {
      const { data, error: fetchError } = await supabase
        .from('standards')
        .select('code, title')
        .eq('id', standardId)
        .single();

      if (fetchError || !data) {
        setError('Standard not found.');
      } else {
        setStandard(data);
      }
      setLoading(false);
    }

    if (standardId) fetchStandard();
  }, [standardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-violet-300 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
          <p className="text-slate-300 text-sm">{error || 'Standard not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/5 border border-violet-500/30 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-6">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">Teach Phase</span>
            <p className="text-violet-400 font-mono text-sm mt-2">{standard.code}</p>
            <h1 className="text-white text-2xl font-extrabold mt-1 leading-tight">{standard.title}</h1>
          </div>
          <p className="text-slate-300 text-sm">Teach phase coming soon.</p>
        </div>
      </div>
    </div>
  );
}
