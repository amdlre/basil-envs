'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@amdlre/design-system';
import { FileCode2, Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { MaskedVariable } from '@/db/queries/variables';
import { hasUnsavedChanges } from '@/lib/unsaved-changes';

import { DiscardChangesDialog } from './discard-changes-dialog';
import { RawEditor } from './raw-editor';
import { VariablesEditor } from './variables-editor';

type Mode = 'editor' | 'raw';

type Props = {
  environmentId: string;
  fileName: string;
  variables: MaskedVariable[];
  version: string;
};

export function VariablesWorkspace({ environmentId, fileName, variables, version }: Props) {
  const t = useTranslations('variables');
  const [mode, setMode] = useState<Mode>('editor');
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  const requestMode = (next: string) => {
    if (next !== 'editor' && next !== 'raw') return;
    if (next === mode) return;
    // Each mode keeps its own draft; switching unmounts it, so confirm first.
    if (hasUnsavedChanges()) setPendingMode(next);
    else setMode(next);
  };

  return (
    <Tabs value={mode} onValueChange={requestMode} className="space-y-4">
      <TabsList>
        <TabsTrigger value="editor" className="gap-2">
          <Rows3 className="size-4" aria-hidden />
          {t('modes.editor')}
        </TabsTrigger>
        <TabsTrigger value="raw" className="gap-2">
          <FileCode2 className="size-4" aria-hidden />
          {t('modes.raw')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="editor" className="mt-0">
        {/* Keyed by version: after any save the editors restart from fresh, masked server state
            while the selected mode survives. */}
        <VariablesEditor
          key={version}
          environmentId={environmentId}
          variables={variables}
          version={version}
        />
      </TabsContent>
      <TabsContent value="raw" className="mt-0">
        <RawEditor
          key={version}
          environmentId={environmentId}
          fileName={fileName}
          version={version}
          variableCount={variables.length}
        />
      </TabsContent>

      <DiscardChangesDialog
        open={pendingMode !== null}
        onCancel={() => {
          setPendingMode(null);
        }}
        onConfirm={() => {
          if (pendingMode) setMode(pendingMode);
          setPendingMode(null);
        }}
      />
    </Tabs>
  );
}
