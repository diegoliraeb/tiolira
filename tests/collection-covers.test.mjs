import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {collectionCover} from '../lib/collection-covers.mjs';

test('the approved nativity cover exists and leaves catalog data intact',async()=>{
 const collection=Object.freeze({id:'presepio',image:'/assets/5e6af6dbc5364235.jpg'});
 const cover=collectionCover(collection);
 await access(new URL('../public'+cover,import.meta.url));
 assert.notEqual(cover,collection.image);
 assert.equal(collection.image,'/assets/5e6af6dbc5364235.jpg');
});
test('later admin edits and new collections retain their own covers',()=>{
 for(const collection of [{id:'presepio',image:'/assets/new-cover.webp'},{id:'presepio',image:''},{id:'new-collection',image:'/assets/new.webp'}])assert.equal(collectionCover(collection),collection.image);
});
