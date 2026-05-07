// Tiny complex-number expression evaluator.
//
// Grammar (Pratt parser):
//   expr   = term (('+' | '-') term)*
//   term   = power (('*' | '/') power)*
//   power  = unary ('^' unary)*    // right-assoc
//   unary  = ('-' | '+') unary | atom
//   atom   = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
//
// Supported identifiers: variable `t`, constants `i`, `e`, `pi`, `tau`.
// Functions: exp, sin, cos, tan, log, sqrt, abs, re, im, conj.

export class Complex {
  constructor(public re: number, public im: number) {}
}

const C = (re: number, im = 0) => new Complex(re, im)

const cAdd = (a: Complex, b: Complex) => C(a.re + b.re, a.im + b.im)
const cSub = (a: Complex, b: Complex) => C(a.re - b.re, a.im - b.im)
const cMul = (a: Complex, b: Complex) =>
  C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
const cDiv = (a: Complex, b: Complex) => {
  const d = b.re * b.re + b.im * b.im
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d)
}
const cNeg = (a: Complex) => C(-a.re, -a.im)
const cExp = (z: Complex) => {
  const k = Math.exp(z.re)
  return C(k * Math.cos(z.im), k * Math.sin(z.im))
}
const cLog = (z: Complex) =>
  C(Math.log(Math.hypot(z.re, z.im)), Math.atan2(z.im, z.re))
const cPow = (a: Complex, b: Complex) => cExp(cMul(b, cLog(a)))
const cSin = (z: Complex) =>
  C(Math.sin(z.re) * Math.cosh(z.im), Math.cos(z.re) * Math.sinh(z.im))
const cCos = (z: Complex) =>
  C(Math.cos(z.re) * Math.cosh(z.im), -Math.sin(z.re) * Math.sinh(z.im))
const cTan = (z: Complex) => cDiv(cSin(z), cCos(z))
const cAbs = (z: Complex) => C(Math.hypot(z.re, z.im), 0)
const cRe = (z: Complex) => C(z.re, 0)
const cIm = (z: Complex) => C(z.im, 0)
const cConj = (z: Complex) => C(z.re, -z.im)
const cSqrt = (z: Complex) => cPow(z, C(0.5))

const FUNCS: Record<string, (a: Complex) => Complex> = {
  exp: cExp,
  sin: cSin,
  cos: cCos,
  tan: cTan,
  log: cLog,
  sqrt: cSqrt,
  abs: cAbs,
  re: cRe,
  im: cIm,
  conj: cConj,
}

const CONSTS: Record<string, Complex> = {
  i: C(0, 1),
  e: C(Math.E),
  pi: C(Math.PI),
  tau: C(2 * Math.PI),
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      // optional exponent: e[+-]?digits
      if (j < src.length && (src[j] === 'e' || src[j] === 'E')) {
        j++
        if (src[j] === '+' || src[j] === '-') j++
        while (j < src.length && /[0-9]/.test(src[j])) j++
      }
      const n = Number(src.slice(i, j))
      if (!Number.isFinite(n)) throw new Error(`Bad number "${src.slice(i, j)}"`)
      tokens.push({ type: 'num', value: n })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      tokens.push({ type: 'ident', value: src.slice(i, j) })
      i = j
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ type: 'op', value: c })
      i++
      continue
    }
    throw new Error(`Unexpected character "${c}"`)
  }
  return tokens
}

type Node =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'call'; name: string; arg: Node }
  | { type: 'unary'; op: string; arg: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }

function parse(src: string): Node {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  const bp = (t: Token | undefined): number => {
    if (!t || t.type !== 'op') return 0
    if (t.value === '+' || t.value === '-') return 10
    if (t.value === '*' || t.value === '/') return 20
    if (t.value === '^') return 30
    return 0
  }

  function parsePrefix(): Node {
    const tok = next()
    if (!tok) throw new Error('Unexpected end of expression')
    if (tok.type === 'num') return { type: 'num', value: tok.value }
    if (tok.type === 'op' && (tok.value === '-' || tok.value === '+')) {
      const arg = parseExpr(80)
      return tok.value === '-' ? { type: 'unary', op: '-', arg } : arg
    }
    if (tok.type === 'lparen') {
      const e = parseExpr(0)
      const close = next()
      if (close?.type !== 'rparen') throw new Error('Expected ")"')
      return e
    }
    if (tok.type === 'ident') {
      if (peek()?.type === 'lparen') {
        next()
        const arg = parseExpr(0)
        const close = next()
        if (close?.type !== 'rparen') throw new Error(`Expected ")" after ${tok.value}(`)
        return { type: 'call', name: tok.value, arg }
      }
      return { type: 'var', name: tok.value }
    }
    throw new Error(`Unexpected token`)
  }

  function parseExpr(rbp: number): Node {
    let left = parsePrefix()
    while (bp(peek()) > rbp) {
      const op = next() as Extract<Token, { type: 'op' }>
      const opBp = bp(op)
      const right = parseExpr(op.value === '^' ? opBp - 1 : opBp)
      left = { type: 'binary', op: op.value, left, right }
    }
    return left
  }

  const result = parseExpr(0)
  if (pos < tokens.length) throw new Error('Trailing tokens')
  return result
}

function evalNode(n: Node, t: number): Complex {
  switch (n.type) {
    case 'num':
      return C(n.value)
    case 'var':
      if (n.name === 't') return C(t)
      if (n.name in CONSTS) return CONSTS[n.name]
      throw new Error(`Unknown identifier "${n.name}"`)
    case 'call': {
      const f = FUNCS[n.name]
      if (!f) throw new Error(`Unknown function "${n.name}"`)
      return f(evalNode(n.arg, t))
    }
    case 'unary':
      return cNeg(evalNode(n.arg, t))
    case 'binary': {
      const a = evalNode(n.left, t)
      const b = evalNode(n.right, t)
      switch (n.op) {
        case '+': return cAdd(a, b)
        case '-': return cSub(a, b)
        case '*': return cMul(a, b)
        case '/': return cDiv(a, b)
        case '^': return cPow(a, b)
      }
      throw new Error(`Bad operator "${n.op}"`)
    }
  }
}

export function compileComplex(src: string): (t: number) => Complex {
  const ast = parse(src)
  return (t) => evalNode(ast, t)
}

export const usesT = (src: string) => /\bt\b/.test(src)
