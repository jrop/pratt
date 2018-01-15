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

test('1 + 2 * (3 + 1) * 3', () =>
	assert.equal(evaluate('1 + 2 * (3 + 1) * 3'), 25))
test('1^2^3', () => assert.equal(evaluate('1^2^3'), 1))
test('(1/2)^-1', () => assert.equal(evaluate('(1/2)^-1'), 2))
test('4^3^2^1', () => assert.equal(evaluate('4^3^2^1'), Math.pow(4, 9)))
test('-1-3', () => assert.equal(evaluate('-1-3'), -4))
test('2*-3', () => assert.equal(evaluate('2*-3'), -6))
test('-2*3', () => assert.equal(evaluate('-2*3'), -6))
test(';1+2;3+4', () => {
	lex.source = ';1+2;3+4'
	assert.equal(parser.parse(), undefined)
	assert.equal(parser.parse(), 3)
	assert.equal(parser.parse(), 7)
})

test('1+ +', () =>
	assert.throws(() => evaluate('1+ +'), /Unexpected token: \+ \(at 1:4\)/))
