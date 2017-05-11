export interface IPosition {
	line: number
	column: number
}
export interface ITokenPosition {
	start: IPosition
	end: IPosition
}
export interface IToken<T> {
	type: T
	match: string
	strpos(): ITokenPosition
	isEof(): boolean
}
export interface ILexer<T> {
	next(): IToken<T>
	peek(): IToken<T>
}

export type NudFunction<T> = (token: IToken<T>, bp: number) => any
export type LedFunction<T> = (left: any, token: IToken<T>, bp: number) => any
export type NudMap<T> = Map<T, NudFunction<T>>
export type LedMap<T> = Map<T, LedFunction<T>>

/**
 * @typedef {function(token: IToken, bp: number): any} NudFunction
 */

/**
 * @typedef {function(left: any, token: IToken, bp: number): any} LedFunction
 */

/**
 * @typedef {{type: string, match: string, isEof: () => boolean}} IToken
 */

/** 
 * @typedef {{
 *   next: () => IToken<T>,
 *   peek: () => IToken<T>
 * }} ILexer
 */

/**
 * A Pratt parser.
 * @example
 * const lex = new perplex.Lexer('1 + -2 * 3^4')
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
export class Parser<T> {
	public lexer: ILexer<T>
	_nuds: NudMap<T>
	_leds: LedMap<T>
	_bps: Map<T, number>

	/**
	 * Constructs a Parser instance
	 * @param {ILexer<T>} lexer The lexer to obtain tokens from
	 */
	constructor(lexer: ILexer<T>) {
		/**
		 * The lexer that this parser is operating on.
		 * @type {ILexer<T>}
		 */
		this.lexer = lexer
		this._nuds  = new Map()
		this._leds  = new Map()
		this._bps   = new Map()
	}

	private _type(tokenOrType: IToken<T>|T): T {
		return tokenOrType && typeof (tokenOrType as IToken<T>).isEof == 'function' ?
			(tokenOrType as IToken<T>).type :
			(tokenOrType as T)
	}

	/**
	 * Create a {@link ParserBuilder}
	 * @return {ParserBuilder<T>} Returns the ParserBuilder
	 */
	builder(): ParserBuilder<T> {
		return new ParserBuilder(this)
	}

	/**
	 * Define binding power for a token-type
	 * @param {IToken<T>|T} tokenOrType The token type to define the binding power for
	 * @returns {number} The binding power of the specified token type
	 */
	bp(tokenOrType: IToken<T>|T) {
		if (tokenOrType == null)
			return Number.NEGATIVE_INFINITY
		if (tokenOrType && typeof (tokenOrType as IToken<T>).isEof == 'function' && (tokenOrType as IToken<T>).isEof())
				return Number.NEGATIVE_INFINITY
		const type = this._type(tokenOrType)
		return this._bps.has(type) ? this._bps.get(type) : Number.POSITIVE_INFINITY
	}

	/**
	 * Computes the token's `nud` value and returns it
	 * @param {IToken<T>} token The token to compute the `nud` from
	 * @returns {any} The result of invoking the pertinent `nud` operator
	 */
	nud(token: IToken<T>) {
		let fn: NudFunction<T> = this._nuds.get(token.type)
		if (!fn) fn = () => {
			const {start} = token.strpos()
			throw new Error(`Unexpected token: ${token.match} (at ${start.line}:${start.column})`)
		}
		return fn(token, this.bp(token))
	}

	/**
	 * Computes a token's `led` value and returns it
	 * @param {any} left The left value
	 * @param {Token<T>} token The token to compute the `led` value for
	 * @returns {any} The result of invoking the pertinent `led` operator
	 */
	led(left: any, token: IToken<T>) {
		const bp = this.bp(token)
		let fn = this._leds.get(token.type)
		if (!fn) fn = () => {
			const {start} = token.strpos()
			throw new Error(`Unexpected token: ${token.match} (at ${start.line}:${start.column})`)
		}
		return fn(left, token, bp)
	}

	/**
	 * Kicks off the Pratt parser, and returns the result
	 * @param {number[]|T[]} rbpsOrTypes The right-binding-powers/token-types at which to stop
	 * @returns {any}
	 */
	parse(...rbpsOrTypes: (number|T)[]): any {
		const check = () => {
			let t = this.lexer.peek()
			const bp = this.bp(t)
			return rbpsOrTypes.reduce((canContinue, rbpOrType) => {
				if (!canContinue) return false
				if (typeof rbpOrType == 'number') return rbpOrType < bp
				if (typeof rbpOrType == 'string') return t.type != rbpOrType
			}, true)
		}
		if (rbpsOrTypes.length == 0)
			rbpsOrTypes.push(0)

		let left = this.nud(this.lexer.next())
		while (check()) {
			const operator = this.lexer.next()
			left = this.led(left, operator)
		}
		return left
	}
}

/**
 * Builds `led`/`nud` rules for a {@link Parser}
 */
export class ParserBuilder<T> {
	private _parser: Parser<T>

	/**
	 * Constructs a ParserBuilder
	 * See also: {@link Parser.builder} 
	 * @param {Parser<T>} parser The parser
	 */
	constructor(parser: Parser<T>) {
		this._parser = parser
	}

	/**
	 * Define `nud` for a token type
	 * @param {T} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {NudFunction<T>} fn The function that will parse the token
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	nud(tokenType: T, bp: number, fn: NudFunction<T>): ParserBuilder<T> {
		this._parser._nuds.set(tokenType, fn)
		this.bp(tokenType, bp)
		return this
	}

	/**
	 * Define `led` for a token type
	 * @param {T} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {LedFunction<T>} fn The function that will parse the token
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	led(tokenType: T, bp: number, fn: LedFunction<T>): ParserBuilder<T> {
		this._parser._leds.set(tokenType, fn)
		this.bp(tokenType, bp)
		return this
	}

	/**
	 * Define both `led` and `nud` for a token type at once.
	 * The supplied `LedFunction` may be called with a null `left`
	 * parameter when invoked from a `nud` context.
	 * @param {strTng} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {LedFunction<T>} fn The function that will parse the token
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	either(tokenType: T, bp: number, fn: LedFunction<T>): ParserBuilder<T> {
		return this.nud(tokenType, bp, (t, bp) => fn(null, t, bp))
			.led(tokenType, bp, fn)
	}

	/**
	 * Define the binding power for a token type
	 * @param {T} tokenType The token type
	 * @param {number} bp The binding power
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	bp(tokenType: T, bp: number): ParserBuilder<T> {
		this._parser._bps.set(tokenType, bp)
		return this
	}

	/**
	 * Returns the parent {@link Parser} instance
	 * @returns {Parser<T>}
	 */
	build(): Parser<T> {
		return this._parser
	}
}

export default Parser
