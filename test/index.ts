import * as assert from 'assert'
import * as test from 'tape'

import Lexer from 'perplex'
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
	assert.equal(evaluate('1 + 2 * (3 + 1) * 3'), 25)
	t.end()
})
test('1^2^3', t => {
	assert.equal(evaluate('1^2^3'), 1)
	t.end()
})
test('(1/2)^-1', t => {
	assert.equal(evaluate('(1/2)^-1'), 2)
	t.end()
})
test('4^3^2^1', t => {
	assert.equal(evaluate('4^3^2^1'), Math.pow(4, 9))
	t.end()
})
test('-1-3', t => {
	assert.equal(evaluate('-1-3'), -4)
	t.end()
})
test('2*-3', t => {
	assert.equal(evaluate('2*-3'), -6)
	t.end()
})
test('-2*3', t => {
	assert.equal(evaluate('-2*3'), -6)
	t.end()
})
test(';1+2;3+4', t => {
	lex.source = ';1+2;3+4'
	assert.equal(parser.parse(), undefined)
	assert.equal(parser.parse(), 3)
	assert.equal(parser.parse(), 7)
	t.end()
})

test('1+ +', t => {
	assert.throws(() => evaluate('1+ +'), /Unexpected token: \+ \(at 1:4\)/)
	t.end()
})
