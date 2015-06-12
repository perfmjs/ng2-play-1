import { status, svg } from './fetch';
import { Defer } from 'common/defer';

let cache: Map<string, any> = new Map();

export class IconStore {
	queue: Map<string, any> = new Map();
	get(url: string): Promise<any> {
		let that: IconStore = this;
		if (cache.has(url)) return Promise.resolve(cache.get(url).cloneNode(true));
		else {
			let pending: boolean = this.queue.has(url);
			let defer = new Defer(); 
			if (!pending) this.queue.set(url, []); 
			let promises: Defer<Node>[] = this.queue.get(url);
			if (pending) promises.push(defer);
			else {
				promises.push(defer);
				window
					.fetch(url)
					.then(status)
					.then(svg)
					.then((element) => {
						cache.set(url, element);
						promises.forEach(promise => promise.resolve(element.cloneNode(true)));
						that.queue.delete(url);
					});	
			}
			return defer.promise;
		}
	}
}