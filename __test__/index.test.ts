import * as assert from 'assert'
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
	.either(';', 1, (left, t, bp, stop) => stop(left))
	.nud('NUM', 100, t => parseInt(t.match))
	.nud('(', 10, (t, bp) => {
		const expr = parser.parse(bp)
		lex.expect(')')
		return expr
	})
	.bp(')', 0)

	.led('^', 20, (left, t, bp) => Math.pow(left, parser.parse(bp - 1)))
	.led('+', 30, (left, t, bp) => left + parser.parse(bp))
	.either('-', 30, (left, t, bp) => (left || 0) - parser.parse(bp))
	.led('*', 40, (left, t, bp) => left * parser.parse(bp))
	.led('/', 40, (left, t, bp) => left / parser.parse(bp))
	.build()

function evaluate(s): number {
	lex.source = s
	return parser.parse()
}

test('1 + 2 * (3 + 1) * 3', () =>
	assert.equal(evaluate('1 + 2 * (3 + 1) * 3'), 25))
test('1^2^3', () =>
	assert.equal(evaluate('1^2^3'), 1))
test('(1/2)^-1', () =>
	assert.equal(evaluate('(1/2)^-1'), 2))
test('4^3^2^1', () =>
	assert.equal(evaluate('4^3^2^1'), Math.pow(4, 9)))
test('-1-3', () =>
	assert.equal(evaluate('-1-3'), -4))
test('2*-3', () =>
	assert.equal(evaluate('2*-3'), -6))
test('-2*3', () =>
	assert.equal(evaluate('-2*3'), -6))
test(';1+2;3+4', () => {
	lex.source = ';1+2;3+4'
	assert.equal(parser.parse(), undefined)
	assert.equal(parser.parse(), 3)
	assert.equal(parser.parse(), 7)
})

test('1+ +', () =>
	assert.throws(() => evaluate('1+ +'), /Unexpected token: \+ \(at 1:4\)/))

