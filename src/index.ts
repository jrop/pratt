export interface IToken {
	type: string
	match: string
}
export interface ILexer {
	next(): IToken
	peek(): IToken
}

export type NudFunction = (token: IToken, bp: number) => any
export type LedFunction = (left: any, token: IToken, bp: number) => any
export type NudMap = Map<string, NudFunction>
export type LedMap = Map<string, LedFunction>

/**
 * @typedef {function(token: IToken, bp: number): any} NudFunction
 */

/**
 * @typedef {function(left: any, token: IToken, bp: number): any} LedFunction
 */

/**
 * @typedef {{type: string, match: string}} IToken
 */

/** 
 * @typedef {{
 *   next: () => IToken,
 *   peek: () => IToken
 * }} ILexer
 */

/**
 * A Pratt parser.
 * @example
 * const lex = perplex('1 + -2 * 3^4')
 *   .token('NUM', /\d+/)
 *   .token('+', /\+/)
 *   .token('-', /-/)
 *   .token('*', new RegExp('*'))
 *   .token('/', /\//)
 *   .token('^', /\^/)
 *   .token('(', /\(/)
 *   .token(')', /\)/)
 *   .token('$SKIP_WS', /\s+/)
 *
 * const parser = new Parser(lex)
 *   .builder()
 *   .nud('NUM', 100, t => parseInt(t.match))
 *   .nud('-', 10, (t, bp) => -parser.parse(bp))
 *   .nud('(', 10, (t, bp) => {
 *     const expr = parser.parse(bp)
 *     lex.expect(')')
 *     return expr
 *   })
 *   .bp(')', 0)
 *
 *   .led('^', 20, (left, t, bp) => Math.pow(left, parser.parse(bp - 1)))
 *   .led('+', 30, (left, t, bp) => left + parser.parse(bp))
 *   .led('-', 30, (left, t, bp) => left - parser.parse(bp))
 *   .led('*', 40, (left, t, bp) => left * parser.parse(bp))
 *   .led('/', 40, (left, t, bp) => left / parser.parse(bp))
 *   .build()
 * parser.parse()
 * // => 161
 */
export class Parser {
	protected lexer: ILexer
	_nuds: NudMap 
	_leds: LedMap
	_bps: Map<string, number>

	/**
	 * Constructs a Parser instance
	 * @param {ILexer} lexer The lexer to obtain tokens from
	 */
	constructor(lexer: ILexer) {
		/**
		 * The lexer that this parser is operating on.
		 * @type {ILexer}
		 */
		this.lexer = lexer
		this._nuds  = new Map()
		this._leds  = new Map()
		this._bps   = new Map()
	}

	private _type(tokenOrType: IToken|string) {
		return typeof tokenOrType == 'string' ? tokenOrType : (tokenOrType as IToken).type
	}

	/**
	 * Create a {@link ParserBuilder}
	 * @return {ParserBuilder} Returns the ParserBuilder
	 */
	builder(): ParserBuilder {
		return new ParserBuilder(this)
	}

	/**
	 * Define binding power for a token-type
	 * @param {IToken|string} tokenOrType The token type to define the binding power for
	 * @returns {number} The binding power of the specified token type
	 */
	bp(tokenOrType: IToken|string) {
		return this._bps.get(this._type(tokenOrType)) || Number.NaN
	}

	/**
	 * Computes the token's `nud` value and returns it
	 * @param {IToken} token The token to compute the `nud` from
	 * @returns {any} The result of invoking the pertinent `nud` operator
	 */
	nud(token: IToken) {
		let fn: NudFunction = this._nuds.get(token.type)
		if (!fn) fn = () => {
			throw new Error(`Unexpected token: ${token.match}`)
		}
		return fn(token, this.bp(token))
	}

	/**
	 * Computes a token's `led` value and returns it
	 * @param {any} left The left value
	 * @param {IToken} token The token to compute the `led` value for
	 * @returns {any} The result of invoking the pertinent `led` operator
	 */
	led(left: any, token: IToken) {
		const bp = this.bp(token)
		let fn = this._leds.get(token.type)
		if (!fn) fn = () => {
			throw new Error(`Unexpected token: ${token.match}`)
		}
		return fn(left, token, bp)
	}

	/**
	 * Kicks of the Pratt parser, and returns the result
	 * @param {number} [rbp=0] The right binding power
	 * @returns {any}
	 */
	parse(rbp: number = 0): any {
		let left = this.nud(this.lexer.next())
		while (rbp < this.bp(this.lexer.peek())) {
			const operator = this.lexer.next()
			left = this.led(left, operator)
		}
		return left
	}
}

/**
 * Builds `led`/`nud` rules for a {@link Parser}
 */
export class ParserBuilder {
	private _parser: Parser

	/**
	 * Constructs a ParserBuilder
	 * See also: {@link Parser.builder} 
	 * @param {Parser} parser The parser
	 */
	constructor(parser: Parser) {
		this._parser = parser
	}

	/**
	 * Define `nud` for a token type
	 * @param {string} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {NudFunction} fn The function that will parse the token
	 * @return {ParserBuilder} Returns this ParserBuilder
	 */
	nud(tokenType: string, bp: number, fn: NudFunction): ParserBuilder {
		this._parser._nuds.set(tokenType, fn)
		this.bp(tokenType, bp)
		return this
	}

	/**
	 * Define `led` for a token type
	 * @param {string} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {LedFunction} fn The function that will parse the token
	 * @return {ParserBuilder} Returns this ParserBuilder
	 */
	led(tokenType: string, bp: number, fn: LedFunction): ParserBuilder {
		this._parser._leds.set(tokenType, fn)
		this.bp(tokenType, bp)
		return this
	}

	/**
	 * Define the binding power for a token type
	 * @param {string} tokenType The token type
	 * @param {number} bp The binding power
	 * @return {ParserBuilder} Returns this ParserBuilder
	 */
	bp(tokenType: string, bp: number): ParserBuilder {
		this._parser._bps.set(tokenType, bp)
		return this
	}

	/**
	 * Returns the parent {@link Parser} instance
	 * @returns {Parser}
	 */
	build(): Parser {
		return this._parser
	}
}

export default Parser
