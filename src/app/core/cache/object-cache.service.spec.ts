import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';

import { ObjectCacheService } from './object-cache.service';
import { AddToObjectCacheAction, RemoveFromObjectCacheAction } from './object-cache.actions';
import { CoreState } from '../core.reducers';
import { ResourceType } from '../shared/resource-type';
import { NormalizedItem } from './models/normalized-item.model';

describe('ObjectCacheService', () => {
  let service: ObjectCacheService;
  let store: Store<CoreState>;

  const selfLink = 'https://rest.api/endpoint/1698f1d3-be98-4c51-9fd8-6bfedcbd59b7';
  const timestamp = new Date().getTime();
  const msToLive = 900000;
  const objectToCache = {
    self: selfLink,
    type: ResourceType.Item
  };
  const cacheEntry = {
    data: objectToCache,
    timeAdded: timestamp,
    msToLive: msToLive
  };
  const invalidCacheEntry = Object.assign({}, cacheEntry, { msToLive: -1 });

  beforeEach(() => {
    store = new Store<CoreState>(undefined, undefined, undefined);
    spyOn(store, 'dispatch');
    service = new ObjectCacheService(store);

    spyOn(Date.prototype, 'getTime').and.callFake(() => {
      return timestamp;
    });
  });

  describe('add', () => {
    it('should dispatch an ADD action with the object to panel-add, the time to live, and the current timestamp', () => {
      service.add(objectToCache, msToLive, selfLink);
      expect(store.dispatch).toHaveBeenCalledWith(new AddToObjectCacheAction(objectToCache, timestamp, msToLive, selfLink));
    });
  });

  describe('remove', () => {
    it('should dispatch a REMOVE action with the self link of the object to remove', () => {
      service.remove(selfLink);
      expect(store.dispatch).toHaveBeenCalledWith(new RemoveFromObjectCacheAction(selfLink));
    });
  });

  describe('getBySelfLink', () => {
    it('should return an observable of the cached object with the specified self link and type', () => {
      spyOn(store, 'select').and.returnValue(Observable.of(cacheEntry));

      // due to the implementation of spyOn above, this subscribe will be synchronous
      service.getBySelfLink(selfLink).take(1).subscribe((o) => {
          expect(o.self).toBe(selfLink);
          // this only works if testObj is an instance of TestClass
          expect(o instanceof NormalizedItem).toBeTruthy();
        }
      );
    });

    it('should not return a cached object that has exceeded its time to live', () => {
      spyOn(store, 'select').and.returnValue(Observable.of(invalidCacheEntry));

      let getObsHasFired = false;
      const subscription = service.getBySelfLink(selfLink).subscribe((o) => getObsHasFired = true);
      expect(getObsHasFired).toBe(false);
      subscription.unsubscribe();
    });
  });

  describe('getList', () => {
    it('should return an observable of the array of cached objects with the specified self link and type', () => {
      const item = new NormalizedItem();
      item.self = selfLink;
      spyOn(service, 'getBySelfLink').and.returnValue(Observable.of(item));

      service.getList([selfLink, selfLink]).take(1).subscribe((arr) => {
        expect(arr[0].self).toBe(selfLink);
        expect(arr[0] instanceof NormalizedItem).toBeTruthy();
      });
    });
  });

  describe('has', () => {
    it('should return true if the object with the supplied self link is cached and still valid', () => {
      spyOn(store, 'select').and.returnValue(Observable.of(cacheEntry));

      expect(service.hasBySelfLink(selfLink)).toBe(true);
    });

    it("should return false if the object with the supplied self link isn't cached", () => {
      spyOn(store, 'select').and.returnValue(Observable.of(undefined));

      expect(service.hasBySelfLink(selfLink)).toBe(false);
    });

    it('should return false if the object with the supplied self link is cached but has exceeded its time to live', () => {
      spyOn(store, 'select').and.returnValue(Observable.of(invalidCacheEntry));

      expect(service.hasBySelfLink(selfLink)).toBe(false);
    });
  });

});
