export function getScrollContainer(el: Element | null): Element | null {
	if (el == null || el.tagName === 'BODY') return null;
	const overflow = window.getComputedStyle(el).getPropertyValue('overflow');
	if (overflow.endsWith('auto')) { // xとyを個別に指定している場合、hidden auto みたいな値になる
		return el;
	} else {
		return getScrollContainer(el.parentElement);
	}
}

export function getScrollPosition(el: Element | null): number {
	const container = getScrollContainer(el);
	return container == null ? window.scrollY : container.scrollTop;
}

export function onScrollTop(el: Element, cb) {
	const container = getScrollContainer(el) || window;
	const onScroll = ev => {
		if (!document.body.contains(el)) return;
		const pos = getScrollPosition(el);
		if (pos === 0) {
			cb();
			container.removeEventListener('scroll', onscroll);
		}
	};
	container.addEventListener('scroll', onScroll, { passive: true });
}

export function onScrollBottom(el: Element, cb) {
	const container = getScrollContainer(el) || window;
	const onScroll = ev => {
		if (!document.body.contains(el)) return;
		const pos = getScrollPosition(el);
		if (pos + el.clientHeight > el.scrollHeight - 1) {
			cb();
			container.removeEventListener('scroll', onscroll);
		}
	};
	container.addEventListener('scroll', onScroll, { passive: true });
}

export function scroll(el: Element, top: number) {
	const container = getScrollContainer(el);
	if (container == null) {
		window.scroll({ top: top, behavior: 'instant' });
	} else {
		container.scrollTop = top;
	}
}

export function isBottom(el: Element, asobi = 0) {
	const container = getScrollContainer(el);
	const current = container
		? el.scrollTop + el.offsetHeight
		: window.scrollY + window.innerHeight;
	const max = container
		? el.scrollHeight
		: document.body.offsetHeight;
	return current >= (max - asobi);
}
