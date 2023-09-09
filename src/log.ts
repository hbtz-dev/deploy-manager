export function log(s: string, prefix: string = "MANAGER") {
    if (prefix.length) {
        console.log(`[${prefix}]:`, s);
    }
}
export function error(s: string, prefix: string = "MANAGER") {
    if (prefix.length) {
        console.error(`[${prefix}]:`, s);
    }
}
