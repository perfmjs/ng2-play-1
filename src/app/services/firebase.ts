import { FunctionWrapper, isFunction, isJsObject } from 'angular2/src/facade/lang';

export const FIREBASE_TIMESTAMP = Firebase.ServerValue.TIMESTAMP;


/**
 * Firebase Array
 */

let refs: Map<string, any> = new Map();

function parseForFirebase (data: any): any {
	if (data && isJsObject(data)) {
		delete data.key;
		if (data.hasOwnProperty('value')) data = data.value;
	}
	if (data === undefined) data = null;
	return data;
}

function findKeyPos (list: Array<any>, key: string): number {
	for (let [i, len] = [0, list.length]; i < len; i++) {
		if (list[i].key === key) return i;
	}
	return -1;
}

function parseVal (key: string, data: any): any {
	if (!isJsObject(data) || !data) data = { value: data };
	data.key = key;
	return data;
}

function applyToBase (base: any, data: any): any {
	if (!isJsObject(base) || !isJsObject(data)) return data;
	else {
		let key: string;
		for (key in base) {
			if (key !== 'key' && base.hasOwnProperty(key) && !data.hasOwnProperty(key)) delete base[key];
		}
		for (key in data) {
			if (data.hasOwnProperty(key)) base[key] = data[key];
		}
		return base;
	}
}

/**
 * Expose a singleton like class.
 * Ensures that if the Angular [router]{@link https://github.com/angular/router} is used,
 * or if the same class is instantiated on the same Firebase reference,
 * we only bind to the [query]{@link https://www.firebase.com/docs/web/api/query/on.html} events once per reference (otherwise we end up with multiple callbacks triggered on the same event).
 * Map the reference url to a list and if the url is found, when the class is instantiated,
 * use that list so updates to the same reference reflect across all instances even if events are not bound.
 *
 * @class
 * @name FirebaseArray
 *
 * @param {Firebase} ref - A Firebase referance (created via `let ref = new Firebase('https://<name>.firebaseio.com')`).
 * @param {Function} callback - A function which will be invoked after any synchronization with Firebase.
 * @returns {FirebaseArray}
 *
 * @example
 * class Galaxies extends FirebaseArray {
 *     constructor() {
 *         let ref = let ref = new Firebase('https://<name>.firebaseio.com');
 *         super(ref, (event, key, record) => {
 *             // this gets called for every sync with Firebase
 *         })
 *     }
 * }
 */

export class FirebaseArray {
	entries: Array<any>;
	_callback: (eventType?: string, key?: string, record?: any) => any;
	_ref: Firebase;
	_subs: Array<Array<any>>;
	constructor(ref: Firebase, callback?: (eventType?: string, key?: string, record?: any) => any) {
		let url: string = ref.toString();
		this._callback = callback;
		this._ref = ref;
		if (refs.has(url)) this._subs = refs.get(url)._subs;
		else {
			refs.set(url, {
				_entries: [],
				_subs: []
			});
			this._subs = refs.get(url)._subs;
			let events: any = {
				child_added: this._added,
				child_changed: this._changed,
				child_moved: this._moved,
				child_removed: this._removed
			};
			for (let name of Object.keys(events)) this._subs.push([
				name,
				this._ref.on(
					name,
					events[name].bind(this)
				)
			]);
		}
		this.entries = refs.get(url)._entries;
	}


	/**
	 * A convenience method to find the array position of a given key.
	 *
	 * @name indexOf
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Key (Firebase path) of the record to find in the `entries`.
	 * @returns {Number} Index of the record (`-1` if not found).
	 */

	indexOf(key: string): number {
		return findKeyPos(this.entries, key);
	}


	/**
	 * Adds a record to Firebase and returns the reference.
	 * To obtain its key, use `ref.key()`, assuming `ref` is the variable assigned to the return value.
	 *
	 * Note that all the records stored in the array are objects.
	 * Primitive values get stored as `{ value: primitive }`.
	 * Moreover, each record will get a new property `key` which is used to do changes to the record (most methods require the `key`).
	 *
	 * @name add
	 * @memberof FirebaseArray
	 *
	 * @param {*} data - Data to add to the array (and sync with Firebase).
	 * @returns {Firebase} A Firebase reference to the data.
	 */

	add(data: any): Firebase {
		let key: string = this._ref.push().key();
		let ref: Firebase = this._ref.child(key);
		if (arguments.length > 0) ref.set(
			parseForFirebase(data),
			this._throw.bind(this, key)
		);
		return ref;
	}


	/**
	 * Replaces the value of a record locally and in Firebase.
	 *
	 * @name set
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Record key to be replaced.
	 * @param {*} data - Data to add to the array (and sync with Firebase).
	 */

	set(key: string, data: any): void {
		this._ref.child(key).set(
			parseForFirebase(data),
			this._throw.bind(this, key)
		);
	}


	/**
	 * Get the value of a record based on it's `key`.
	 *
	 * @name get
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Record key to be replaced.
 	 * @returns {*} Record.
	 */

	get(key: string): any {
		let idx = this.indexOf(key);
		if (idx === -1) return null;
		return this.entries[idx];
	}


	/**
	 * Updates the value of a record, replacing any keys that are in data with the values provided and leaving the rest of the record alone.
	 *
	 * @name update
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Record key to be udapted.
	 * @param {*} data - Data to merge into the record (and sync with Firebase).
	 */

	update(key: string, data: any): void {
		this._ref.child(key).update(
			parseForFirebase(data),
			this._throw.bind(this, key)
		);
	}


	/**
	 * Moves a record locally and in the remote data list.
	 *
	 * @name move
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Record key to be moved.
	 * @param {(String|Number)} priority - Sort order to be applied.
	 */

	move(key: string, priority: any): void {
		this._ref.child(key).setPriority(priority);
	}


	/**
	 * Removes a record locally and from Firebase.
	 *
	 * @name remove
	 * @memberof FirebaseArray
	 *
	 * @param {String} key - Record key to be removed.
	 */

	remove(key: string): void {
		this._ref.child(key).remove(
			this._throw.bind(null, key)
		);
	}


	/**
	 * Unsubscribes from all Firebase [events]@{link https://www.firebase.com/docs/web/api/query/on.html} (`child_added`, `child_changed`, `child_moved`, `child_removed`).
	 * This means that the changes will still be pushed to Firebase,
	 * but there will be no callbacks and if data is changed from another client, it will not be reflected on the current client.
	 *
	 * @name disconnect
	 * @memberof FirebaseArray
	 */

	disconnect(): void {
		let ref: Firebase = this._ref;
		this._subs.forEach((sub) => {
			ref.off(sub[0], sub[1]);
		});
		this._subs = [];
	}


	_added(snapshot: FirebaseDataSnapshot, prevKey?: string): void {
		let key: string = snapshot.key();
		let record = parseVal(
			key,
			snapshot.val()
		);
		this._move(key, record, prevKey);
		this._tick('child_added', key, record);
	}
	_changed(snapshot: FirebaseDataSnapshot): void {
		let key: string = snapshot.key();
		let pos: number = this.indexOf(key);
		if (pos !== -1) {
			this.entries[pos] = applyToBase(
				this.entries[pos],
				parseVal(
					key,
					snapshot.val()
				)
			);
			this._tick('child_changed', key, this.entries[pos]);
		}
	}
	_moved(snapshot: FirebaseDataSnapshot, prevKey?: string): void {
		let key: string = snapshot.key();
		let oldPos: number = this.indexOf(key);
		if( oldPos !== -1 ) {
			let record: any = this.entries[oldPos];
			this.entries.splice(oldPos, 1);
			this._move(key, record, prevKey);
			this._tick('child_moved', key, record);
		}
	}
	_removed(snapshot: FirebaseDataSnapshot): void {
		let key: string = snapshot.key();
		let pos: number = this.indexOf(key);
		if (pos !== -1) {
			this.entries.splice(pos, 1);
			this._tick('child_removed', key);
		}
	}

	_getRecordPos(key: string, prevKey?: string): number {
		if (prevKey === null) return 0;
		else {
			let idx = this.indexOf(prevKey);
			if (idx === -1) return this.entries.length;
			else return idx + 1;
		}
	}
	_move(key: string, record: any, prevKey?: string): void {
		let pos: number = this._getRecordPos(key, prevKey);
		this.entries.splice(pos, 0, record);
	}

	_tick(eventType: string, key: string, record?: any): void {
		if (isFunction(this._callback)) FunctionWrapper.apply(
			this._callback,
			[eventType, key].concat(
				record ? [record] : []
			)
		);
	}
	_throw(key: string, err: any): void {
		if (err) this._tick('error', key);
	}
}