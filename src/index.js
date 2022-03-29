const Module = require('module');
const originalRequire = Module.prototype.require;

const DURATION_THRESHOLD =
    parseInt(process.env['TREQ_DURATION_THRESHOLD']) || 10;
const DISABLED = process.env['TREQ_DISABLE'] === 'true';

class RequireTrace {
    constructor(moduleId) {
        this.moduleId = moduleId;
        this.duration = 0;
        this.children = [];
    }
}

const activeReqs = [];

function traceRequire(id) {
    // Get current time
    const ts = process.hrtime();

    // Create new require trace
    const reqTrace = new RequireTrace(id);
    const numOfActiveReqs = activeReqs.length;
    // Get parent require trace
    const parentReqTrace =
        numOfActiveReqs === 0 ? null : activeReqs[numOfActiveReqs - 1];
    if (parentReqTrace) {
        // Link current require trace as child of parent require trace
        parentReqTrace.children.push(reqTrace);
    }

    let res;
    // Push new require traces onto stack as current require trace
    activeReqs.push(reqTrace);
    try {
        res = originalRequire.call(this, id);
    } finally {
        // Pop new require trace from stack as it is not current require trace anymore
        activeReqs.pop();
    }

    // Calculate passed time
    const passedTime = process.hrtime(ts);
    // Set duration of the current require trace
    reqTrace.duration = passedTime[0] * 1000 + passedTime[1] / 1e6;

    // If current require trace is the root trace
    if (numOfActiveReqs === 0) {
        // Dump it with its children
        dumpRequireStack(reqTrace);
    }

    return res;
}

function dumpRequireStack(reqTrace, depth = 0) {
    if (reqTrace.duration && reqTrace.duration >= DURATION_THRESHOLD) {
        let indent = '';
        for (let i = 0; i < depth; i++) {
            indent += '..';
        }
        console.log(
            "%s|-- require('%s') took %s ms",
            indent,
            reqTrace.moduleId,
            reqTrace.duration
        );
        for (let childReqTrace of reqTrace.children) {
            dumpRequireStack(childReqTrace, depth + 1);
        }
    }
}

if (!DISABLED) {
    Module.prototype.require = traceRequire;
}
