const core = globalThis.__bootstrap;

// https://www.w3.org/TR/user-timing/
// Derived from: https://github.com/blackswanny/performance-polyfill
class Performance {
    constructor() {
        this._startTime = core.hrtimeMs();
        this._entries = [];
        this._marksIndex = Object.create(null);
    }

    get timeOrigin() {
        return this._startTime;
    }

    now() {
        return core.hrtimeMs() - this._startTime;
    }

    mark(name) {
        const mark = {
            name,
            entryType: 'mark',
            startTime: this.now(),
            duration: 0
        };
        this._entries.push(mark);
        this._marksIndex[name] = mark;
    }

    measure(name, startMark, endMark) {
        let startTime;
        let endTime;
  
        if (endMark !== undefined && this._marksIndex[endMark] === undefined) {
          throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + endMark + "' does not exist.");
        }
  
        if (startMark !== undefined && this._marksIndex[startMark] === undefined) {
          throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + startMark + "' does not exist.");
        }
  
        if (this._marksIndex[startMark]) {
          startTime = this._marksIndex[startMark].startTime;
        } else {
          startTime = 0;
        }
  
        if (this._marksIndex[endMark]) {
          endTime = this._marksIndex[endMark].startTime;
        } else {
          endTime = this.now();
        }
  
        const mark = {
            name,
            entryType: 'measure',
            startTime,
            duration: endTime - startTime
        };
        this._entries.push(mark);
    }

    getEntriesByType(type) {
        return this._entries.filter(entry => entry.entryType === type);
    }

    getEntriesByName(name) {
        return this._entries.filter(entry => entry.name === name);
    }

    clearMarks(name) {
        if (typeof name === 'undefined') {
            this._entries = this._entries.filter(entry => entry.entryType !== 'mark');
        } else {
            const entry = this._entries.find(e => e.entryType === 'mark' && e.name === name);
            this._entries.splice(this._entries.indexOf(entry), 1);
            delete this._marksIndex[name];
        }
    }

    clearMeasures(name) {
        if (typeof name === 'undefined') {
            this._entries = this._entries.filter(entry => entry.entryType !== 'measure');
        } else {
            const entry = this._entries.find(e => e.entryType === 'measure' && e.name === name);
            this._entries.splice(this._entries.indexOf(entry), 1);
        }
    }
}


Object.defineProperty(window, 'performance', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Performance()
});
