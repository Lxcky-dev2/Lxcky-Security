"use strict";

class RateLimitManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.globalDelay = 250;
    }

    async enqueue(task, guildId = null) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                task,
                guildId,
                resolve,
                reject,
                timestamp: Date.now()
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            try {
                const result = await item.task();
                item.resolve(result);
            } catch (error) {
                if (error.status === 429 && error.retry_after) {
                    console.warn(`[RATELIMIT] Hit 429! Waiting ${error.retry_after}ms...`);
                    await this.sleep(error.retry_after + 100);
                    this.queue.unshift(item);
                    continue;
                }
                item.reject(error);
            }

            await this.sleep(this.globalDelay);
        }

        this.processing = false;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setGlobalDelay(ms) {
        this.globalDelay = ms;
    }
}

const instance = new RateLimitManager();
module.exports = instance;