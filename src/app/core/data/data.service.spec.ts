import { DataService } from './data.service';
import { NormalizedObject } from '../cache/models/normalized-object.model';
import { ResponseCacheService } from '../cache/response-cache.service';
import { RequestService } from './request.service';
import { RemoteDataBuildService } from '../cache/builders/remote-data-build.service';
import { CoreState } from '../core.reducers';
import { Store } from '@ngrx/store';
import { HALEndpointService } from '../shared/hal-endpoint.service';
import { Observable } from 'rxjs/Observable';
import { FindAllOptions } from './request.models';
import { SortOptions, SortDirection } from '../cache/models/sort-options.model';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { getMockRequestService } from '../../shared/mocks/mock-request.service';
import { getMockResponseCacheService } from '../../shared/mocks/mock-response-cache.service';
import { DSpaceObject } from '../shared/dspace-object.model';
import { RemoteData } from './remote-data';
import { RequestEntry } from './request.reducer';
import { getMockRemoteDataBuildService } from '../../shared/mocks/mock-remote-data-build.service';
import { EmptyError } from 'rxjs/util/EmptyError';
import { ResponseCacheEntry } from '../cache/response-cache.reducer';
import { ErrorResponse, RestResponse } from '../cache/response-cache.models';
import { hasValue } from '../../shared/empty.util';
import { map } from 'rxjs/operators';
import { RemoteDataError } from './remote-data-error';

const LINK_NAME = 'test';

// tslint:disable:max-classes-per-file
class NormalizedTestObject extends NormalizedObject {
}

class TestService extends DataService<NormalizedTestObject, any> {
    constructor(
        protected responseCache: ResponseCacheService,
        protected requestService: RequestService,
        protected rdbService: RemoteDataBuildService,
        protected store: Store<CoreState>,
        protected linkPath: string,
        protected halService: HALEndpointService,
        protected authService: AuthService,
        protected notificationsService: NotificationsService,
        protected http: HttpClient
    ) {
        super();
    }

    public getScopedEndpoint(scope: string): Observable<string> {
        throw new Error('getScopedEndpoint is abstract in DataService');
    }

}

describe('DataService', () => {
    let service: TestService;
    let options: FindAllOptions;
    let responseCache = getMockResponseCacheService();
    let rdbService = {} as RemoteDataBuildService;
    const authService = {} as AuthService;
    const notificationsService = {} as NotificationsService;
    const http = {} as HttpClient;
    const store = {} as Store<CoreState>;
    const endpoint = 'https://rest.api/core';
    const halService = Object.assign({
      getEndpoint: (linkpath) => Observable.of(endpoint)
    });
    const requestService = Object.assign(getMockRequestService(), {
      getByUUID: () => Observable.of(new RequestEntry()),
      configure: (request) => request
    });

    const dso = new DSpaceObject();
    const successfulRd$ = Observable.of(new RemoteData(false, false, true, undefined, dso));
    const successfulResponseCacheEntry = {
      response: {
        isSuccessful: true,
        payload: dso,
        toCache: true,
        statusCode: '200'
      } as RestResponse
    } as ResponseCacheEntry;

    function initSuccessfulRemoteDataBuildService(): RemoteDataBuildService {
      return {
        toRemoteDataObservable: (requestEntry$: Observable<RequestEntry>, responseCache$: Observable<ResponseCacheEntry>, payload$: Observable<any>) => {
          requestEntry$.subscribe();
          responseCache$.subscribe();
          payload$.subscribe();
          return successfulRd$;
        }
      } as RemoteDataBuildService;
    }
    function initSuccessfulResponseCacheService(): ResponseCacheService {
      return getMockResponseCacheService(Observable.of(new ResponseCacheEntry()), Observable.of(successfulResponseCacheEntry));
    }

    function initTestService(): TestService {
        return new TestService(
            responseCache,
            requestService,
            rdbService,
            store,
            LINK_NAME,
            halService,
            authService,
            notificationsService,
            http
          );
    }

    service = initTestService();

    describe('getFindAllHref', () => {

        it('should return an observable with the endpoint', () => {
            options = {};

            (service as any).getFindAllHref(endpoint).subscribe((value) => {
                    expect(value).toBe(endpoint);
                }
            );
        });

        // getScopedEndpoint is not implemented in abstract DataService
        it('should throw error if scopeID provided in options', () => {
            options = { scopeID: 'somevalue' };

            expect(() => { (service as any).getFindAllHref(endpoint, options) })
                .toThrowError('getScopedEndpoint is abstract in DataService');
        });

        it('should include page in href if currentPage provided in options', () => {
            options = { currentPage: 2 };
            const expected = `${endpoint}?page=${options.currentPage - 1}`;

            (service as any).getFindAllHref(endpoint, options).subscribe((value) => {
                expect(value).toBe(expected);
            });
        });

        it('should include size in href if elementsPerPage provided in options', () => {
            options = { elementsPerPage: 5 };
            const expected = `${endpoint}?size=${options.elementsPerPage}`;

            (service as any).getFindAllHref(endpoint, options).subscribe((value) => {
                expect(value).toBe(expected);
            });
        });

        it('should include sort href if SortOptions provided in options', () => {
            const sortOptions = new SortOptions('field1', SortDirection.ASC);
            options = { sort:  sortOptions};
            const expected = `${endpoint}?sort=${sortOptions.field},${sortOptions.direction}`;

            (service as any).getFindAllHref(endpoint, options).subscribe((value) => {
                expect(value).toBe(expected);
            });
        });

        it('should include startsWith in href if startsWith provided in options', () => {
            options = { startsWith: 'ab' };
            const expected = `${endpoint}?startsWith=${options.startsWith}`;

            (service as any).getFindAllHref(endpoint, options).subscribe((value) => {
                expect(value).toBe(expected);
            });
        });

        it('should include all provided options in href', () => {
            const sortOptions = new SortOptions('field1', SortDirection.DESC);
            options = {
                currentPage: 6,
                elementsPerPage: 10,
                sort: sortOptions,
                startsWith: 'ab'
            };
            const expected = `${endpoint}?page=${options.currentPage - 1}&size=${options.elementsPerPage}` +
                `&sort=${sortOptions.field},${sortOptions.direction}&startsWith=${options.startsWith}`;

            (service as any).getFindAllHref(endpoint, options).subscribe((value) => {
                expect(value).toBe(expected);
        });
        })
    });

    describe('create', () => {

      describe('when the request was successful', () => {
        beforeEach(() => {
          responseCache = initSuccessfulResponseCacheService();
          rdbService = initSuccessfulRemoteDataBuildService();
          service = initTestService();
        });

        it('should return a RemoteData of a DSpaceObject', () => {
          service.create(dso, undefined).subscribe((rd: RemoteData<DSpaceObject>) => {
            expect(rd.payload).toBe(dso);
          });
        });

        it('should get the response from cache with the correct url when parent is empty', () => {
          const expectedUrl = endpoint;

          service.create(dso, undefined).subscribe((value) => {
            expect(responseCache.get).toHaveBeenCalledWith(expectedUrl);
          });
        });

        it('should get the response from cache with the correct url when parent is not empty', () => {
          const parent = 'fake-parent-uuid';
          const expectedUrl = `${endpoint}?parent=${parent}`;

          service.create(dso, parent).subscribe((value) => {
            expect(responseCache.get).toHaveBeenCalledWith(expectedUrl);
          });
        });
      });

    });

});
