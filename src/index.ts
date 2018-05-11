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
export interface ILexer<T, TType extends IToken<T>> {
	next(): TType
	peek(): TType
}

export type BPResolver = () => number
export type BP = number | BPResolver

export type StopFunction = (<T>(x: T) => T) & {isStopped(): boolean}

export type NudInfo<T, TType extends IToken<T>> = {
	token: TType
	bp: number
	stop: StopFunction
	options: ParseOpts<T>
}
export type LedInfo<T, TType extends IToken<T>> = NudInfo<T, TType> & {
	left: any
}

export type NudFunction<T, TType extends IToken<T>> = (
	inf: NudInfo<T, TType>
) => any
export type LedFunction<T, TType extends IToken<T>> = (
	inf: LedInfo<T, TType>
) => any

export type NudMap<T, TType extends IToken<T>> = Map<T, NudFunction<T, TType>>
export type LedMap<T, TType extends IToken<T>> = Map<T, LedFunction<T, TType>>

export type ParseOpts<T> = {
	ctx?: any
	stop?: StopFunction
	terminals?: (number | T)[]
}

const createStop = <T>(): StopFunction => {
	let stopCalled = false
	return Object.assign(
		(x: T) => {
			stopCalled = true
			return x
		},
		{
			isStopped() {
				return stopCalled
			},
		}
	) as StopFunction
}

/**
 * A Pratt parser.
 *
 * ```typescript
 * import Lexer, {Token} from 'perplex'
 * import {Parser} from 'pratt'
 *
 * const lex = new Lexer('1 + -2 * 3^4').build(lex => {
 *   lex.tokenTypes
 *     .define('NUM', /\d+/)
 *     .defineOperator('+', '+')
 *     .defineOperator('-', '-')
 *     .defineOperator('*', '*')
 *     .defineOperator('/', '/')
 *     .defineOperator('^', '^')
 *     .defineOperator('(', '(')
 *     .defineOperator(')', ')')
 *     .define('WS', /\s+/, true)
 * })
 *
 * const parser: Parser<string, Token<string>> = new Parser<string, Token<string>>(lex)
 *   .build(define =>
 *     define
 *       .bp(null, -1) // EOF
 *       .nud('NUM', 100, i => parseInt(i.token.match))
 *       .nud('(', 10, ({bp}) => {
 *         const expr = parser.parse({terminals: [bp]})
 *         lex.expect(')')
 *         return expr
 *       })
 *       .bp(')', 0)
 *       .led('^', 20, ({left, bp}) =>
 *         Math.pow(left, parser.parse({terminals: [20 - 1]}))
 *       )
 *       .led('+', 30, ({left, bp}) => left + parser.parse({terminals: [bp]}))
 *       .either(
 *         '-',
 *         30,
 *         ({left, bp}) => (left || 0) - parser.parse({terminals: [bp]})
 *       )
 *       .led('*', 40, ({left, bp}) => left * parser.parse({terminals: [bp]}))
 *       .led('/', 40, ({left, bp}) => left / parser.parse({terminals: [bp]}))
 *   )
 * parser.parse()
 * // => 161
 * ```
 */
export class Parser<T, TType extends IToken<T>> {
	public lexer: ILexer<T, TType>

	/**
	 * @hidden
	 */
	_nuds: NudMap<T, TType>
	/**
	 * @hidden
	 */
	_leds: LedMap<T, TType>
	/**
	 * @hidden
	 */
	_bps: Map<T, BP>

	/**
	 * Constructs a Parser instance
	 * @param {ILexer<T>} lexer The lexer to obtain tokens from
	 */
	constructor(lexer: ILexer<T, TType>) {
		/**
		 * The lexer that this parser is operating on.
		 * @type {ILexer<T>}
		 */
		this.lexer = lexer
		this._nuds = new Map()
		this._leds = new Map()
		this._bps = new Map()
	}

	private _type(tokenOrType: TType | T): T {
		return tokenOrType && typeof (tokenOrType as TType).isEof == 'function'
			? (tokenOrType as TType).type
			: (tokenOrType as T)
	}

	/**
	 * Build the parser
	 * @return Returns the Parser
	 */
	build(builder: (define: ParserBuilder<T, TType>) => any): this {
		builder(new ParserBuilder(this))
		return this
	}

	/**
	 * Define binding power for a token-type
	 * @param {IToken<T>|T} tokenOrType The token type to define the binding power for
	 * @returns {number} The binding power of the specified token type
	 */
	bp(tokenOrType: TType | T) {
		if (tokenOrType == null) return Number.NEGATIVE_INFINITY
		if (
			tokenOrType &&
			typeof (tokenOrType as TType).isEof == 'function' &&
			(tokenOrType as TType).isEof()
		)
			return Number.NEGATIVE_INFINITY
		const type = this._type(tokenOrType)
		const bp = this._bps.has(type)
			? this._bps.get(type)
			: Number.POSITIVE_INFINITY
		return typeof bp == 'function' ? bp() : bp
	}

	/**
	 * Computes the token's `nud` value and returns it
	 * @param {NudInfo<T>} info The info to compute the `nud` from
	 * @returns {any} The result of invoking the pertinent `nud` operator
	 */
	nud(info: NudInfo<T, TType>) {
		let fn: NudFunction<T, TType> = this._nuds.get(info.token.type)
		if (!fn) {
			const {start} = info.token.strpos()
			throw new Error(
				`Unexpected token: ${info.token.match} (at ${start.line}:${
					start.column
				})`
			)
		}
		return fn(info)
	}

	/**
	 * Computes a token's `led` value and returns it
	 * @param {LedInfo<T>} info The info to compute the `led` value for
	 * @returns {any} The result of invoking the pertinent `led` operator
	 */
	led(info: LedInfo<T, TType>) {
		let fn = this._leds.get(info.token.type)
		if (!fn) {
			const {start} = info.token.strpos()
			throw new Error(
				`Unexpected token: ${info.token.match} (at ${start.line}:${
					start.column
				})`
			)
		}
		return fn(info)
	}

	/**
	 * Kicks off the Pratt parser, and returns the result
	 * @param {ParseOpts<T>} opts The parse options
	 * @returns {any}
	 */
	parse(opts: ParseOpts<T> = {terminals: [0]}): any {
		const stop = (opts.stop = opts.stop || createStop())
		const check = () => {
			if (stop.isStopped()) return false
			let t = this.lexer.peek()
			const bp = this.bp(t)
			return opts.terminals.reduce((canContinue, rbpOrType) => {
				if (!canContinue) return false
				if (typeof rbpOrType == 'number') return rbpOrType < bp
				if (typeof rbpOrType == 'string') return t.type != rbpOrType
			}, true)
		}
		const mkinfo = (token: TType): NudInfo<T, TType> => {
			const bp = this.bp(token)
			return {token, bp, stop, options: opts}
		}
		if (!opts.terminals) opts.terminals = [0]
		if (opts.terminals.length == 0) opts.terminals.push(0)

		let left = this.nud(mkinfo(this.lexer.next()))
		while (check()) {
			const operator = this.lexer.next()
			left = this.led(Object.assign(mkinfo(operator), {left}))
		}
		return left
	}

	/**
	 * Parse a list of values
	 * @param opts
	 */
	parseList(opts: {
		consumeCloser: () => any
		consumeSeparator: () => any
		isNextCloser: () => boolean
		isNextSeparator: () => boolean
		parseItem: () => any
	}): any[] {
		const items = []
		let peek: TType
		while (!opts.isNextCloser()) {
			items.push(opts.parseItem())
			if (opts.isNextSeparator()) opts.consumeSeparator()
		}
		opts.consumeCloser()
		return items
	}
}

/**
 * Builds `led`/`nud` rules for a {@link Parser}
 */
export class ParserBuilder<T, TType extends IToken<T>> {
	private _parser: Parser<T, TType>

	/**
	 * Constructs a ParserBuilder
	 * See also: {@link Parser.builder}
	 * @param {Parser<T>} parser The parser
	 */
	constructor(parser: Parser<T, TType>) {
		this._parser = parser
	}

	/**
	 * Define `nud` for a token type
	 * @param {T} tokenType The token type
	 * @param {number} bp The binding power
	 * @param {NudFunction<T>} fn The function that will parse the token
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	nud(tokenType: T, bp: BP, fn: NudFunction<T, TType>): this {
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
	led(tokenType: T, bp: BP, fn: LedFunction<T, TType>): this {
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
	either(tokenType: T, bp: BP, fn: LedFunction<T, TType>): this {
		return this.nud(tokenType, bp, inf =>
			fn(Object.assign(inf, {left: null}))
		).led(tokenType, bp, fn)
	}

	private _binary(
		op: T,
		bp: number,
		rightAssociative: boolean,
		create: (left, op: T, right) => any
	): this {
		this.led(op, bp, inf => {
			const start = inf.left.start
			const right = this._parser.parse({
				terminals: [rightAssociative ? bp - 1 : bp],
				stop: inf.stop,
			})
			return create(inf.left, op, right)
		})
		return this
	}

	/**
	 * A helper for parsing binary operators (left-associative)
	 * @param op The operator
	 * @param bp The binding power
	 * @param create A function that creates the AST node
	 */
	binary(op: T, bp: number, create: (left, op: T, right) => any): this {
		return this._binary(op, bp, false, create)
	}

	/**
	 * A helper for parsing binary operators (right-associative)
	 * @param op The operator
	 * @param bp The binding power
	 * @param create A function that creates the AST node
	 */
	rassoc(op: T, bp: number, create: (left, op: T, right) => any): this {
		return this._binary(op, bp, true, create)
	}

	/**
	 * A helper for parsing unary operators
	 * @param op The operator
	 * @param bp The binding power
	 * @param create A function that creates the AST node
	 */
	unary(op: T, bp: number, create: (op: T, target) => any): this {
		this.nud(op, bp, inf => {
			const right = this._parser.parse({terminals: [inf.bp], stop: inf.stop})
			return create(op, right)
		})
		return this
	}

	/**
	 * Define the binding power for a token type
	 * @param {T} tokenType The token type
	 * @param {BP} bp The binding power
	 * @return {ParserBuilder<T>} Returns this ParserBuilder
	 */
	bp(tokenType: T, bp: BP): this {
		this._parser._bps.set(tokenType, bp)
		return this
	}
}

export default Parser
