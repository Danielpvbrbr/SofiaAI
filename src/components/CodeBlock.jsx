import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ language, value }) {
  // Limpa e valida os dados de entrada
  const cleanValue = typeof value === 'string' ? value.trim() : '';
  const cleanLanguage = typeof language === 'string' ? language.toLowerCase().trim() : 'javascript';
  
  // Se não tiver conteúdo, não renderiza nada
  if (!cleanValue) {
    return null;
  }
  
  // Mapeamento de linguagens para garantir compatibilidade
  const languageMap = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'cmd': 'batch',
    'yml': 'yaml',
    'md': 'markdown',
    'html': 'markup',
    'xml': 'markup',
  };
  
  const finalLanguage = languageMap[cleanLanguage] || cleanLanguage || 'javascript';

  return (
    <div style={{ margin: '16px 0' }}>
      {/* Cabeçalho com a linguagem */}
      <div style={{
        background: '#1a1a1a',
        color: '#888',
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        borderBottom: '1px solid #333',
        fontFamily: 'Monaco, Consolas, monospace'
      }}>
        {finalLanguage}
      </div>
      
      <SyntaxHighlighter
        language={finalLanguage}
        style={oneDark}
        showLineNumbers={cleanValue.split('\n').length > 3}
        wrapLongLines={true}
        customStyle={{
          margin: 0,
          padding: '16px',
          fontSize: '14px',
          lineHeight: '1.5',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
        codeTagProps={{
          style: {
            fontFamily: 'Monaco, Consolas, "Ubuntu Mono", monospace',
          }
        }}
      >
        {cleanValue}
      </SyntaxHighlighter>
    </div>
  );
}