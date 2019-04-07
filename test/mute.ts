/*
 * Tests of mute
 *
 * How to run the tests:
 * > mocha test/mute.ts --require ts-node/register
 *
 * To specify test:
 * > mocha test/mute.ts --require ts-node/register -g 'test name'
 *
 * If the tests not start, try set following enviroment variables:
 * TS_NODE_FILES=true and TS_NODE_TRANSPILE_ONLY=true
 * for more details, please see: https://github.com/TypeStrong/ts-node/issues/754
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import * as childProcess from 'child_process';
import { async, signup, request, post, react, connectStream } from './utils';

describe('Mute', () => {
	let p: childProcess.ChildProcess;

	// alice mutes carol
	let alice: any;
	let bob: any;
	let carol: any;

	before(done => {
		p = childProcess.spawn('node', [__dirname + '/../index.js'], {
			stdio: ['inherit', 'inherit', 'ipc'],
			env: { NODE_ENV: 'test' }
		});
		p.on('message', async message => {
			if (message === 'ok') {
				(p.channel as any).onread = () => {};
				alice = await signup({ username: 'alice' });
				bob = await signup({ username: 'bob' });
				carol = await signup({ username: 'carol' });
				done();
			}
		});
	});

	after(() => {
		p.kill();
	});

	it('ミュート作成', async(async () => {
		const res = await request('/mute/create', {
			userId: carol.id
		}, alice);

		assert.strictEqual(res.status, 204);
	}));

	it('「自分宛ての投稿」にミュートしているユーザーの投稿が含まれない', async(async () => {
		const bobNote = await post(bob, { text: '@alice hi' });
		const carolNote = await post(carol, { text: '@alice hi' });

		const res = await request('/notes/mentions', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.some(note => note.id === bobNote.id), true);
		assert.strictEqual(res.body.some(note => note.id === carolNote.id), false);
	}));

	it('ミュートしているユーザーからメンションされても、hasUnreadMentions が true にならない', async(async () => {
		// 状態リセット
		await request('/i/read-all-unread-notes', {}, alice);

		await post(carol, { text: '@alice hi' });

		const res = await request('/i', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.hasUnreadMentions, false);
	}));

	it('ミュートしているユーザーからメンションされても、ストリームに unreadMention イベントが流れてこない', () => new Promise(async done => {
		// 状態リセット
		await request('/i/read-all-unread-notes', {}, alice);

		let fired = false;

		const ws = await connectStream(alice, 'main', ({ type }) => {
			if (type == 'unreadMention') {
				fired = true;
			}
		});

		post(carol, { text: '@alice hi' });

		setTimeout(() => {
			assert.strictEqual(fired, false);
			ws.close();
			done();
		}, 5000);
	}));

	it('ミュートしているユーザーからメンションされても、ストリームに unreadNotification イベントが流れてこない', () => new Promise(async done => {
		// 状態リセット
		await request('/i/read-all-unread-notes', {}, alice);
		await request('/notifications/mark-all-as-read', {}, alice);

		let fired = false;

		const ws = await connectStream(alice, 'main', ({ type }) => {
			if (type == 'unreadNotification') {
				fired = true;
			}
		});

		post(carol, { text: '@alice hi' });

		setTimeout(() => {
			assert.strictEqual(fired, false);
			ws.close();
			done();
		}, 5000);
	}));

	describe('Timeline', () => {
		it('タイムラインにミュートしているユーザーの投稿が含まれない', async(async () => {
			const aliceNote = await post(alice);
			const bobNote = await post(bob);
			const carolNote = await post(carol);

			const res = await request('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.some(note => note.id === aliceNote.id), true);
			assert.strictEqual(res.body.some(note => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some(note => note.id === carolNote.id), false);
		}));

		it('タイムラインにミュートしているユーザーの投稿のRenoteが含まれない', async(async () => {
			const aliceNote = await post(alice);
			const carolNote = await post(carol);
			const bobNote = await post(bob, {
				renoteId: carolNote.id
			});

			const res = await request('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.some(note => note.id === aliceNote.id), true);
			assert.strictEqual(res.body.some(note => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some(note => note.id === carolNote.id), false);
		}));
	});

	describe('Notification', () => {
		it('通知にミュートしているユーザーの通知が含まれない(リアクション)', async(async () => {
			const aliceNote = await post(alice);
			await react(bob, aliceNote, 'like');
			await react(carol, aliceNote, 'like');

			const res = await request('/i/notifications', {}, alice);

			assert.strictEqual(res.status, 200);
			assert.strictEqual(Array.isArray(res.body), true);
			assert.strictEqual(res.body.some(notification => notification.userId === bob.id), true);
			assert.strictEqual(res.body.some(notification => notification.userId === carol.id), false);
		}));
	});
});