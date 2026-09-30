import ts from 'typescript';
export function typescriptDecorators() {
  return {
    name: 'typescript-decorator-metadata',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return;
      return {
        code: ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            esModuleInterop: true,
          },
          fileName: id,
        }).outputText,
        map: null,
      };
    },
  };
}
