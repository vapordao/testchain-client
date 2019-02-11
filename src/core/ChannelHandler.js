import { Observable } from 'rxjs';
import debug from 'debug';
import assert from 'assert';

const createLogger = label => debug(`log-${label}`);

const events = [
  'phx_reply',
  'status_changed',
  'error',
  'failed',
  'starting',
  'started',
  'deploying',
  'deployed',
  'deployment_failed',
  'ready',
  'terminated',
  'snapshot_taken',
  'snapshot_reverted'
];

export default class ChannelHandler {
  constructor(name, socket) {
    this._name = name;
    this._channel = socket.channel(this._name);
    this._stream = this._buildChannelStream(events);
    this._log = createLogger(this._name);
    this._logger = this._stream.subscribe(value =>
      this._log(JSON.stringify(value, null, 4))
    );
    this.init();
  }

  _buildChannelStream(eventsList) {
    return new Observable(subscriber => {
      const setChannelEvent = event => {
        this._channel.on(event, data => {
          switch (event) {
            case 'deployment_failed':
              subscriber.error({ event, payload: data });
              break;
            case 'error':
              subscriber.error({ event, payload: data });
              break;
            case 'failed':
              subscriber.error({ event, payload: data });
              break;
            default:
              subscriber.next({ event, payload: data });
          }
        });
      };

      eventsList.forEach(event => {
        setChannelEvent(event);
      });
    });
  }

  once(predicate = () => true) {
    assert(
      typeof predicate === 'function',
      'argument must be a function callback'
    );

    return new Promise(resolve => {
      const observer = this._stream.subscribe(
        ({ event, payload }) => {
          assert(
            typeof predicate(event, payload) === 'boolean',
            'function callback must return a boolean'
          );

          if (predicate(event, payload)) {
            observer.unsubscribe();
            resolve({ event, payload });
          }
        },
        ({ event, payload }) => {
          throw new Error(JSON.stringify({ event, payload }, null, 4));
        }
      );
    });
  }

  init() {
    this._channel.join();
  }

  push(event, payload = {}) {
    this._channel.push(event, payload);
  }

  stream() {
    return this._stream;
  }

  joined() {
    return this._channel.state === 'joined' ? true : false;
  }
}
