# Usage

The included Pratt parser encapsulates the following:

* the infamous parsing algorithm
* a mechanism to halt parsing from within the LED/NUD functions
* a `Parser.parseList(...)` helper
* a `ParserBuilder` with many convenience utilities

## Instantiation

A parser operates on a Lexer.  The Lexer must adhere to the following interface:

```typescript
interface IPosition {
  line: number
  column: number
}
interface IToken<T> {
  type: T
  match: string
  strpos(): {
    start: IPosition
    end: IPosition
  }
  isEof(): boolean
}
interface ILexer<T, TType extends IToken<T>> {
  next(): TType
  peek(): TType
}
```

The parser is constructed as follows:

```typescript
import {Token} from 'SOME-LEXER-LIB'
import {Parser} from 'pratt'

const lexer = ...
const parser = new Parser<string, Token<string>>(lexer)
```

## Setup

To initialize the parser and setup LED/NUD operators, call `.build(...)`:

```typescript
const parser = new Parser<string, Token<string>>(lexer)
  .build(define => {
    define.bp(...)
    define.nud(...)
    define.led(...)
    define.either(...)
    define.unary(...)
    define.binary(...)
    define.rassoc(...)
  })
```

To parse expressions, call `parse(...)`
