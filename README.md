# pratt

[![Greenkeeper badge](https://badges.greenkeeper.io/jrop/pratt.svg)](https://greenkeeper.io/)

A Pratt parser builder.

Pratt parsers are top-down operator precedence (TDOP) parsers, and they are awesome.  They operate off of a few simple principles, and make expression parsing simple.

Read more about Pratt parsers:

* [here](http://javascript.crockford.com/tdop/tdop.html) (TDOP by Douglas Crockford)
* [here](http://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/) (Pratt Parsers: Expression Parsing Made Easy)
* [and here](https://tdop.github.io/) (Top Down Operator Precedence [the original paper by Vaughan R. Pratt])

## Installation

```sh
npm install --save pratt
# or
yarn add pratt
```

## Usage

This README merely serves as an example. Be sure to [read the API documentation](https://jrop.github.io/pratt/index.html).

Make a simple calculator:

```js
import * as perplex from 'perplex'
import {Parser} from 'pratt'

const lex = perplex('1 + -2 * 3^4')
	.token('NUM', /\d+/)
	.token('+', /\+/)
	.token('-', /-/)
	.token('*', /\*/)
	.token('/', /\//)
	.token('^', /\^/)
	.token('(', /\(/)
	.token(')', /\)/)
	.token('$SKIP_WS', /\s+/)

const parser = new Parser(lex)
	.builder()
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

parser.parse()
// => -161
```

## License (ISC)

ISC License (ISC)
Copyright 2017 Jonathan Apodaca <jrapodaca@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
