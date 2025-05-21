// Initialize Mermaid (for parse tree)
mermaid.initialize({ startOnLoad: false });

const declaredVariables = new Map(); // variableName -> { type, scope }
const scopes = ['global']; // current scope stack

// UI Elements
const codeInput = document.getElementById('codeInput');
const compileBtn = document.getElementById('compileBtn');
const autoFormatBtn = document.getElementById('autoFormatBtn');
const compilerOutput = document.getElementById('compilerOutput');
const errorOutput = document.getElementById('errorOutput');
const symbolTableBody = document.querySelector('#symbolTable tbody');
const parseTreeContainer = document.getElementById('parseTreeContainer');
const toggleThemeBtn = document.getElementById('toggleThemeBtn');

const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Tab switching logic
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tabContents.forEach(tc => tc.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Theme toggle
toggleThemeBtn.onclick = () => {
  document.body.classList.toggle('dark-mode');
  toggleThemeBtn.textContent = document.body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
}

// Compile button handler
compileBtn.onclick = () => {
  const code = codeInput.value.trim();
  clearAllOutputs();

  if (!code) {
    showError("Error: No code provided.");
    return;
  }

  const tokens = lexicalAnalysis(code);
  const syntaxResult = validateSyntax(tokens);
  const semanticResult = semanticCheck(tokens);
  const intermediateCode = generateIntermediateCode(tokens);
  const parseTree = generateParseTree(tokens);

  // Show outputs
  compilerOutput.textContent = `=== Lexical Tokens ===\n${JSON.stringify(tokens, null, 2)}\n\n`;

  if (syntaxResult.valid) {
    compilerOutput.innerHTML += `<span class="success">Syntax is valid.</span>\n\n`;
  } else {
    showError(`Syntax Error: ${syntaxResult.message}`);
  }

  if (semanticResult.valid) {
    compilerOutput.innerHTML += `<span class="success">No semantic errors.</span>\n\n`;
  } else {
    showError(`Semantic Error: ${semanticResult.message}`);
  }

  if (syntaxResult.valid && semanticResult.valid) {
    if (intermediateCode.length > 0) {
      compilerOutput.innerHTML += `=== Intermediate Code ===\n${intermediateCode.join('\n')}\n\n`;
    } else {
      compilerOutput.innerHTML += "No Intermediate Code generated.\n\n";
    }
  }

  // Symbol Table
  populateSymbolTable();

  // Parse Tree
  parseTreeContainer.innerHTML = `<div class="mermaid">${parseTree}</div>`;
  try {
    mermaid.init(undefined, parseTreeContainer);
  } catch (e) {
    showError("Parse tree rendering error.");
  }
};

// Auto-format button handler (basic indentation)
autoFormatBtn.onclick = () => {
  const formatted = autoFormatCode(codeInput.value);
  codeInput.value = formatted;
  alert("Code auto-formatted.");
}

// Export JSON button
document.getElementById('exportJSONBtn').onclick = () => {
  const output = {
    code: codeInput.value,
    tokens: lexicalAnalysis(codeInput.value),
    // Add more fields if needed
  };
  downloadFile('output.json', JSON.stringify(output, null, 2));
};

// Export PDF button
document.getElementById('exportPDFBtn').onclick = () => {
  exportPDF(compilerOutput.textContent);
};

// Helper functions
function clearAllOutputs() {
  compilerOutput.textContent = "";
  errorOutput.textContent = "";
  symbolTableBody.innerHTML = "";
  parseTreeContainer.innerHTML = "";
  declaredVariables.clear();
  scopes.length = 1;
  scopes[0] = 'global';
}

function showError(msg) {
  errorOutput.textContent += msg + "\n";
}

function lexicalAnalysis(code) {
  const regex = /\b\w+\b|[{}();=+-/*<>]/g;
  const tokens = [];
  let match;
  while ((match = regex.exec(code)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function validateSyntax(tokens) {
  const stack = [];
  const pairs = { '{': '}', '(': ')' };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '{' || t === '(') stack.push(t);
    else if (t === '}' || t === ')') {
      if (stack.length === 0) return { valid: false, message: `Unexpected '${t}' at token ${i}` };
      const last = stack.pop();
      if (pairs[last] !== t) return { valid: false, message: `Mismatched '${last}' and '${t}' at token ${i}` };
    }
  }
  if (stack.length > 0) return { valid: false, message: "Unclosed braces or parentheses." };
  return { valid: true };
}

function semanticCheck(tokens) {
  declaredVariables.clear();
  scopes.length = 1;
  scopes[0] = 'global';

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'var') {
      const varName = tokens[i + 1];
      if (!varName || !isIdentifier(varName)) {
        return { valid: false, message: `Invalid variable name at token ${i + 1}` };
      }
      declaredVariables.set(varName, { type: 'var', scope: scopes[scopes.length - 1] });
      i++;
    } else if (isIdentifier(tokens[i])) {
      if (!declaredVariables.has(tokens[i])) {
        return { valid: false, message: `Variable "${tokens[i]}" used before declaration at token ${i}` };
      }
    }
  }
  return { valid: true };
}

function isIdentifier(token) {
  return /^[a-zA-Z_]\w*$/.test(token) && !['var', 'if', 'else', 'while'].includes(token);
}

function generateIntermediateCode(tokens) {
  const code = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'var') {
      const varName = tokens[i + 1];
      code.push(`DECLARE ${varName}`);
      i++;
    } else if (tokens[i + 1] === '=') {
      code.push(`${tokens[i]} = ${tokens[i + 2]}`);
      i += 2;
    }
  }
  return code;
}

function generateParseTree(tokens) {
  let tree = 'graph TD\n';
  let nodeCount = 0;
  function nextNodeId() {
    return `N${nodeCount++}`;
  }
  let root = nextNodeId();
  tree += `${root}[Program]\n`;

  for (let i = 0; i < tokens.length; i++) {
    const child = nextNodeId();
    tree += `${child}[${tokens[i]}]\n`;
    tree += `${root} --> ${child}\n`;
  }
  return tree;
}

function populateSymbolTable() {
  symbolTableBody.innerHTML = "";
  declaredVariables.forEach((info, name) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${name}</td><td>${info.type}</td><td>${info.scope}</td>`;
    symbolTableBody.appendChild(row);
  });
}

function autoFormatCode(code) {
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentSize = 2;
  const formattedLines = [];

  lines.forEach(line => {
    line = line.trim();
    if (line.endsWith('}')) indentLevel--;
    if (indentLevel < 0) indentLevel = 0;

    formattedLines.push(' '.repeat(indentLevel * indentSize) + line);

    if (line.endsWith('{')) indentLevel++;
  });

  return formattedLines.join('\n');
}

function downloadFile(filename, content) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: 'application/json' });
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPDF(text) {
  if (!window.jspdf) {
    alert("PDF export requires jsPDF library. Please add it.");
    return;
  }
  const doc = new jspdf.jsPDF();
  const splitText = doc.splitTextToSize(text, 180);
  doc.text(splitText, 10, 10);
  doc.save('output.pdf');
}

// Load jsPDF dynamically
(function loadJsPDF() {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  script.onload = () => { window.jspdf = window.jspdf || window.jspdf.jsPDF; };
  document.head.appendChild(script);
})();
