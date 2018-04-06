import * as assert from 'assert'
import * as test from 'tape'
import * as sinon from 'sinon'

import Lexer, {Token} from 'perplex'
import {Parser} from '../src/index'

const lex = new Lexer<string>()
	.token('NUM', /\d+/)
	.token(';', /;/)
	.token('+', /\+/)
	.token('-', /-/)
	.token('*', /\*/)
	.token('/', /\//)
	.token('^', /\^/)
	.token('(', /\(/)
	.token(')', /\)/)
	.token('WS', /\s+/, true)

const parser: Parser<string> = new Parser<string>(lex)
	.builder()
	.bp('EOF', -1)
	.either(';', 1, ({left, stop}) => stop(left))
	.nud('NUM', 100, i => parseInt(i.token.match))
	.nud('(', 10, ({bp}) => {
		const expr = parser.parse({terminals: [bp]})
		lex.expect(')')
		return expr
	})
	.bp(')', 0)

	.led('^', 20, ({left, bp}) =>
		Math.pow(left, parser.parse({terminals: [20 - 1]}))
	)
	.led('+', 30, ({left, bp}) => left + parser.parse({terminals: [bp]}))
	.either(
		'-',
		30,
		({left, bp}) => (left || 0) - parser.parse({terminals: [bp]})
	)
	.led('*', 40, ({left, bp}) => left * parser.parse({terminals: [bp]}))
	.led('/', 40, ({left, bp}) => left / parser.parse({terminals: [bp]}))
	.build()

function evaluate(s): number {
	lex.source = s
	return parser.parse()
}

test('1 + 2 * (3 + 1) * 3', t => {
	t.equal(evaluate('1 + 2 * (3 + 1) * 3'), 25)
	t.end()
})
test('1^2^3', t => {
	t.equal(evaluate('1^2^3'), 1)
	t.end()
})
test('(1/2)^-1', t => {
	t.equal(evaluate('(1/2)^-1'), 2)
	t.end()
})
test('4^3^2^1', t => {
	t.equal(evaluate('4^3^2^1'), Math.pow(4, 9))
	t.end()
})
test('-1-3', t => {
	t.equal(evaluate('-1-3'), -4)
	t.end()
})
test('2*-3', t => {
	t.equal(evaluate('2*-3'), -6)
	t.end()
})
test('-2*3', t => {
	t.equal(evaluate('-2*3'), -6)
	t.end()
})
test(';1+2;3+4', t => {
	lex.source = ';1+2;3+4'
	t.equal(parser.parse(), null)
	t.equal(parser.parse(), 3)
	t.equal(parser.parse(), 7)
	t.end()
})
test('1+ +', t => {
	t.throws(() => evaluate('1+ +'), /Unexpected token: \+ \(at 1:4\)/)
	t.end()
})
test('BPResolver', t => {
	const bpResolver = sinon.spy(() => 100)
	parser.builder().bp('NUM', bpResolver as () => number)

	t.equal(evaluate('1'), 1)
	t.assert(bpResolver.calledOnce)
	t.deepLooseEqual(bpResolver.returnValues, [100])
	t.end()
})
test('parser.bp(null) == -Infinity', t => {
	t.equal(parser.bp(null), Number.NEGATIVE_INFINITY)
	t.end()
})
test('parser.bp("DOES_NOT_EXIST") == +Infinity', t => {
	t.equal(parser.bp('DOES_NOT_EXIST'), Number.POSITIVE_INFINITY)
	t.end()
})
test('parser.led({token: {type: "UNEXPECTED"}}) throws', t => {
	t.throws(
		() =>
			parser.led({
				token: new Token<string>('UNEXPECTED', '...', [], 0, 0, lex),
			} as any),
		/unexpected/i
	)
	t.end()
})
test('parser.parse({terminals: [...]})', t => {
	lex.source = '1'
	t.equal(
		parser.parse({terminals: null}),
		1,
		'auto-inits `terminals` (from null)'
	)
	lex.position = 0

	lex.source = '1'
	t.equal(
		parser.parse({terminals: []}),
		1,
		'auto-inits `terminals` (from `[]`)'
	)
	lex.position = 0

	lex.source = '1 2'
	t.equal(parser.parse({terminals: ['NUM', 0]}), 1, 'terminates upon a NUM')
	lex.position = 0
	t.end()
})
