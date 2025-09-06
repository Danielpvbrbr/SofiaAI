import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ language, value }) {
  return (
    <SyntaxHighlighter
      language={language || "javascript"}
      style={oneDark}
      customStyle={{
        borderRadius: "10px",
        padding: "15px",
        fontSize: "14px",
      }}
      showLineNumbers
    >
      {value}
    </SyntaxHighlighter>
  );
}
