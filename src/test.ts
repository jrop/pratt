import * as assert from 'assert'
import * as perplex from 'perplex'
import {Parser} from './index'

const lex = perplex('')
	.token('NUM', /\d+/)
	.token('+', /\+/)
	.token('-', /-/)
	.token('*', /\*/)
	.token('/', /\//)
	.token('^', /\^/)
	.token('(', /\(/)
	.token(')', /\)/)
	.token('$SKIP_WS', /\s+/)

const parser: Parser = new Parser(lex)
	.builder()
	.bp('$EOF', -1)
	.nud('NUM', 100, t => parseInt(t.match))
	.nud('-', 10, (t, bp) => -parser.parse(bp))
	.nud('(', 10, (t, bp) => {
		const expr = parser.parse(bp)
		lex.expect(')')
		return expr
	})
	.bp(')', 0)

	.led('^', 20, (left, t, bp) => Math.pow(left, parser.parse(bp - 1)))
	.led('+', 30, (left, t, bp) => left + parser.parse(bp))
	.led('-', 30, (left, t, bp) => left - parser.parse(bp))
	.led('*', 40, (left, t, bp) => left * parser.parse(bp))
	.led('/', 40, (left, t, bp) => left / parser.parse(bp))
	.build()

function evaluate(s): number {
	lex.source = s
	return parser.parse()
}

assert.equal(evaluate('1 + 2 * (3 + 1) * 3'), 25)
assert.equal(evaluate('1^2^3'), 1)
assert.equal(evaluate('(1/2)^-1'), 2)
assert.equal(evaluate('4^3^2^1'), Math.pow(4, 9))
assert.equal(evaluate('-1-3'), -4)
assert.equal(evaluate('2*-3'), -6)
assert.equal(evaluate('-2*3'), -6)

console.log('All tests passed')
