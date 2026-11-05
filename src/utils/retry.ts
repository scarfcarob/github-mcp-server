import { AppError } from "../errors/index.js";
import { logger } from "./logging.js";




export interface RetryOptions {

    maxRetries: number; 

    baseDelayMs: number; 

    maxDelayMs: number; 

}



export const DEFAULT_RETRY: RetryOptions = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10_000 };



const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



export async function withRetry<T>(

    fn: () => Promise<T>,

    toError: (err: unknown) => AppError,

    opts: RetryOptions = DEFAULT_RETRY,

    retryOn: (err: AppError) => boolean = (err) => err.retryable,

): Promise<T> {

    for (let attempt = 0; ; attempt++) {

        try {

            return await fn();

        } catch (raw) {

            const err = toError(raw); 

            if (!retryOn(err) || attempt >= opts.maxRetries) throw err;



            const retryAfter = Number(err.details?.["retryAfter"]);

            const backoff = opts.baseDelayMs * 2 ** attempt;

            const waitMs = Math.min(retryAfter > 0 ? retryAfter * 1000 : backoff, opts.maxDelayMs);

            logger.warn("reintentando request", { attempt: attempt + 1, waitMs, code: err.code, status: err.status });

            await sleep(waitMs);

        }

    }

} 