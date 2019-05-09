import * as puppeteer from 'puppeteer';
import * as httpServer from 'http-server';
import * as http from "http";
import * as assert from 'assert';
import { Runner, Suite } from 'mocha';
import * as util from 'util';

var browser: puppeteer.Browser;
var server: http.Server;

before(async () => {
    browser = await puppeteer.launch({
        args: [
            // Required for Docker version of Puppeteer
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // This will write shared memory files into /tmp instead of /dev/shm,
            // because Docker’s default for /dev/shm is 64MB
            '--disable-dev-shm-usage'
        ]
    });

    server = httpServer.createServer({ root: '.' });
    const promise = util.promisify(server.listen.bind(server));
    await promise(9999);
});

after(() => {
    browser.close();
    server.close();
});

describe('client test', function () {
    this.timeout(10000);

    it('in browser', async () => {
        const page = await browser.newPage();

        page.on('console', msg => {
            for (let i = 0; i < msg.args().length; ++i)
                console.log(`[Console] ${i}: ${msg.args()[i]}`);
        });

        console.log("Loading browser tests...")
        await page.goto('http://localhost:9999/html/index.html');

        console.log("Waiting for tests to run...")
        await page.waitForFunction(() => {
            return (window as any).mochaRunEnd;
        });

        console.log("Extracting results...")
        await page.pdf({ path: 'mocha.pdf' });

        var summary = await page.evaluate(() => {
            var suite = (window as any).suite;
            return {
                total: suite.total,
                failures: suite.failures
            };
        });

        console.log("Checking results...")

        assert(summary.total > 0);
        assert(summary.failures === 0);

        console.log("Done.")

        await page.close();
    });
});
