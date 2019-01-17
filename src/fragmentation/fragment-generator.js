export default class FragmentGenerator {
	str
	offset = 0

	constructor(str) {
		this.str = str
	}

	get more() {
		return this.str.length > this.offset
	}

	get remaining() {
		return this.str.length - this.offset
	}

	next(len) {
		const offset = this.offset
		this.offset += len
		return this.str.slice(offset, offset + len)
	}
}
