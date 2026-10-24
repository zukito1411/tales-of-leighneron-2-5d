import ts from 'typescript';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
const sheets={};
function literal(node){
  if(ts.isStringLiteral(node)||ts.isNumericLiteral(node))return ts.isNumericLiteral(node)?Number(node.text):node.text;
  if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
  if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken)return -literal(node.operand);
  if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,literal(p.initializer)]));
}
for(const file of ['src/data/art.ts','src/data/nativePropArt.ts']){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){
    if(ts.isObjectLiteralExpression(node)){
      const value=literal(node);if(value?.key&&value.path&&(value.regions||value.sources))sheets[value.key]=value;
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
writeFileSync(join(tmpdir(),'leighneron-prop-sources.json'),JSON.stringify(sheets));
console.log('Read literal source registrations:',Object.keys(sheets).length);
