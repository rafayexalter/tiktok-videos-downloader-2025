import dotenv from "dotenv";
import fs from "graceful-fs";
import https from "https";
import path from "path";
import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
dotenv.config();

async function downloadVideo(
  url,
  filename,
  referrer,
  { cookies, headers },
  retryCount = 0
) {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  return new Promise((resolve, reject) => {
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const requestHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Encoding": "identity;q=1, *;q=0",
      "Accept-Language": "en-US,en;q=0.9",
      Range: "bytes=0-",
      Referer: referrer,
      Origin: "https://www.tiktok.com",
      Connection: "keep-alive",
      Cookie: cookieHeader,
      ...headers,
    };

    const options = {
      headers: requestHeaders,
      followRedirect: true,
      maxRedirects: 5,
    };

    let totalBytes = 0;
    let receivedBytes = 0;

    const request = https.get(url, options, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error("No redirect URL provided"));
          return;
        }

        downloadVideo(
          redirectUrl,
          filename,
          referrer,
          { cookies, headers },
          retryCount
        )
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200 && response.statusCode !== 206) {
        if (retryCount < maxRetries) {
          console.log(
            `Retrying download (${
              retryCount + 1
            }/${maxRetries}) after ${retryDelay}ms...`
          );
          setTimeout(() => {
            downloadVideo(
              url,
              filename,
              referrer,
              { cookies, headers },
              retryCount + 1
            )
              .then(resolve)
              .catch(reject);
          }, retryDelay);
          return;
        }
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      // Get total size if available
      if (response.headers["content-length"]) {
        totalBytes = parseInt(response.headers["content-length"], 10);
        console.log(
          `Total video size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        );
      }

      const fileStream = fs.createWriteStream(filename);

      response.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = ((receivedBytes / totalBytes) * 100).toFixed(2);
          process.stdout.write(
            `\rDownloading... ${percent}% (${(
              receivedBytes /
              (1024 * 1024)
            ).toFixed(2)} MB)`
          );
        }
      });

      response.pipe(fileStream);

      fileStream.on("finish", () => {
        process.stdout.write("\n"); // New line after progress
        const stats = fs.statSync(filename);
        // Check if file size is too small (less than 100KB) or significantly smaller than expected
        if (
          stats.size < 100000 ||
          (totalBytes > 0 && stats.size < totalBytes * 0.95)
        ) {
          fs.unlinkSync(filename);
          if (retryCount < maxRetries) {
            console.log(
              `File incomplete (${(stats.size / (1024 * 1024)).toFixed(
                2
              )} MB), retrying (${
                retryCount + 1
              }/${maxRetries}) after ${retryDelay}ms...`
            );
            setTimeout(() => {
              downloadVideo(
                url,
                filename,
                referrer,
                { cookies, headers },
                retryCount + 1
              )
                .then(resolve)
                .catch(reject);
            }, retryDelay);
            return;
          }
          reject(
            new Error(
              `Downloaded file too small: ${(
                stats.size /
                (1024 * 1024)
              ).toFixed(2)} MB`
            )
          );
          return;
        }
        fileStream.close();
        console.log(
          `Download complete: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`
        );
        resolve();
      });

      fileStream.on("error", (err) => {
        fs.unlink(filename, () => {
          if (retryCount < maxRetries) {
            console.log(
              `Download error, retrying (${
                retryCount + 1
              }/${maxRetries}) after ${retryDelay}ms...`
            );
            setTimeout(() => {
              downloadVideo(
                url,
                filename,
                referrer,
                { cookies, headers },
                retryCount + 1
              )
                .then(resolve)
                .catch(reject);
            }, retryDelay);
          } else {
            reject(err);
          }
        });
      });
    });

    request.on("error", (err) => {
      if (retryCount < maxRetries) {
        console.log(
          `Connection error, retrying (${
            retryCount + 1
          }/${maxRetries}) after ${retryDelay}ms...`
        );
        setTimeout(() => {
          downloadVideo(
            url,
            filename,
            referrer,
            { cookies, headers },
            retryCount + 1
          )
            .then(resolve)
            .catch(reject);
        }, retryDelay);
      } else {
        reject(err);
      }
    });

    // Set a timeout for the request
    request.setTimeout(30000, () => {
      request.destroy();
      if (retryCount < maxRetries) {
        console.log(
          `Download timeout, retrying (${
            retryCount + 1
          }/${maxRetries}) after ${retryDelay}ms...`
        );
        setTimeout(() => {
          downloadVideo(
            url,
            filename,
            referrer,
            { cookies, headers },
            retryCount + 1
          )
            .then(resolve)
            .catch(reject);
        }, retryDelay);
      } else {
        reject(new Error("Download timeout"));
      }
    });
  });
}

async function runPuppeteer(url) {
  try {
    puppeteerExtra.use(stealthPlugin());

    let browser;

    browser = await puppeteerExtra.launch({
      headless: "new",
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", // your local path to chrome. Use chat gpt for help
    });

    const page = await browser.newPage();
    const responses = [];

    // Add request interception to get cookies from requests
    await page.setRequestInterception(true);
    let requestHeaders = {};

    page.on("request", async (request) => {
      if (request.url().includes("tiktok.com")) {
        requestHeaders = request.headers();
      }
      await request.continue();
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (url?.includes("item_list")) {
        let jsonRes = null;
        try {
          const resBody = await response.text();
          jsonRes = JSON.parse(resBody);
        } catch (error) {
          console.error("Error processing response:", error);
        }
        if (jsonRes) {
          responses.push(jsonRes);
        }
      }
    });

    await page.goto(url);

    // Try different selectors for video count
    let totalVideoCount = 0;
    try {
      await page.waitForSelector('[data-e2e="user-post-item-list"]', {
        timeout: 5000,
      });
      totalVideoCount = await page.evaluate(() => {
        // Try different possible selectors for video count
        const selectors = [
          ".video-count strong",
          '[data-e2e="user-post-count"]',
          ".count-infos .number",
          ".video-count",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const count = parseInt(
              element.textContent.replace(/,/g, "").match(/\d+/)?.[0] || "0",
              10
            );
            if (count > 0) return count;
          }
        }

        // If no count found, count the video elements
        return document.querySelectorAll('[data-e2e="user-post-item"]').length;
      });
    } catch (error) {
      console.log(
        "Could not find video count element, will count videos directly"
      );
      totalVideoCount = await page.evaluate(
        () => document.querySelectorAll('[data-e2e="user-post-item"]').length
      );
    }

    console.log(`Initial video count on profile: ${totalVideoCount}`);

    // Scroll to load all videos
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Prevent infinite scrolling
    let noNewVideosCount = 0;
    let previousLoadedVideos = 0;

    console.log("Scrolling to load all videos...");
    while (scrollAttempts < maxScrollAttempts) {
      // Scroll to bottom
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await new Promise((r) => setTimeout(r, 2000)); // Wait for content to load

      // Get new height
      const currentHeight = await page.evaluate("document.body.scrollHeight");

      // Count loaded videos
      const loadedVideos = await page.evaluate(
        () => document.querySelectorAll('[data-e2e="user-post-item"]').length
      );
      console.log(`Loaded ${loadedVideos} videos`);

      // Check if we're still loading new videos
      if (loadedVideos === previousLoadedVideos) {
        noNewVideosCount++;
        if (noNewVideosCount >= 3) {
          // If no new videos loaded after 3 attempts, stop
          console.log("No new videos loaded after multiple attempts, stopping");
          break;
        }
      } else {
        noNewVideosCount = 0;
      }

      // Update total count if we found more videos than initially detected
      if (loadedVideos > totalVideoCount) {
        totalVideoCount = loadedVideos;
      }

      // If height hasn't changed
      if (currentHeight === previousHeight) {
        console.log("Reached end of page");
        break;
      }

      previousHeight = currentHeight;
      previousLoadedVideos = loadedVideos;
      scrollAttempts++;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("Processing all videos from responses...");
    const downloadPromises = [];
    let videoCounter = 1;

    // Get your profile's uniqueId from the URL
    const profileUsername = url.split("@")[1];
    console.log(`Filtering videos for profile: @${profileUsername}`);

    // Get total number of videos (only from your profile)
    const uniqueVideoIds = new Set();
    const uniqueVideos = []; // Store full video data for processing
    responses.forEach((response) => {
      if (response?.itemList) {
        response.itemList.forEach((item) => {
          if (
            item?.author?.uniqueId === profileUsername &&
            !uniqueVideoIds.has(item.id)
          ) {
            uniqueVideoIds.add(item.id);
            uniqueVideos.push(item);
          }
        });
      }
    });
    const totalVideos = uniqueVideoIds.size;

    console.log(`Found ${totalVideos} unique videos from @${profileUsername}`);

    // Process all responses
    let failedDownloads = [];
    let successfulDownloads = new Set(); // Track successful downloads by videoId

    async function attemptDownload(
      videoUrl,
      videoId,
      videoCounter,
      maxAttempts = 3
    ) {
      const filename = path.join("downloads", `xsavr_${videoId}.mp4`);

      if (successfulDownloads.has(videoId)) {
        console.log(
          `Video ${videoCounter} (ID: ${videoId}) already downloaded successfully`
        );
        return true;
      }

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            console.log(
              `Retry attempt ${attempt}/${maxAttempts} for video ${videoCounter} (ID: ${videoId})`
            );
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retry
          }

          const pageCookies = await page.cookies();
          const msToken = pageCookies.find((c) => c.name === "msToken")?.value;
          const ttChainToken = pageCookies.find(
            (c) => c.name === "tt_chain_token"
          )?.value;
          const ttCsrfToken = pageCookies.find(
            (c) => c.name === "tt_csrf_token"
          )?.value;
          const ttwid = pageCookies.find((c) => c.name === "ttwid")?.value;

          await downloadVideo(videoUrl, filename, url, {
            cookies: pageCookies,
            headers: {
              ...requestHeaders,
              msToken: msToken,
              tt_chain_token: ttChainToken,
              "tt-csrf-token": ttCsrfToken,
              ttwid: ttwid,
            },
          });

          successfulDownloads.add(videoId);
          return true;
        } catch (err) {
          console.error(
            `Attempt ${attempt}/${maxAttempts} failed for video ${videoCounter}:`,
            err.message
          );
          if (attempt === maxAttempts) {
            failedDownloads.push({
              videoCounter,
              videoId,
              videoUrl,
              error: err.message,
            });
          }
        }
      }
      return false;
    }

    // First pass: try to download all videos
    let processedCounter = 1; // Track actual video number being processed
    let downloadCounter = 0; // Track successful downloads

    // Process unique videos instead of responses
    for (const item of uniqueVideos) {
      const video = item?.video;
      if (video?.bitrateInfo) {
        // Sort bitrateInfo by bitrate to get highest quality first
        const sortedBitrateInfo = video.bitrateInfo.sort(
          (a, b) => b.Bitrate - a.Bitrate
        );

        // Get the first URL from UrlList (direct video URL)
        const videoUrl = sortedBitrateInfo[0]?.PlayAddr?.UrlList?.[0];
        const videoId = item.id;

        if (!videoUrl) {
          console.log(`No valid URL found for video ${videoId}`);
          continue;
        }

        if (!fs.existsSync("downloads")) {
          fs.mkdirSync("downloads");
        }

        console.log(
          `Attempting to download video ${processedCounter} of ${totalVideos}`
        );
        console.log("Video ID:", videoId);
        console.log("Video URL:", videoUrl);

        const success = await attemptDownload(
          videoUrl,
          videoId,
          processedCounter
        );
        if (success) {
          downloadCounter++;
          console.log(
            `Successfully downloaded video ${downloadCounter} (ID: ${videoId})`
          );
        }
        processedCounter++;
      }
    }

    // Retry failed downloads
    if (failedDownloads.length > 0) {
      console.log("\nRetrying failed downloads...");
      const retryAttempts = 3;

      for (let attempt = 1; attempt <= retryAttempts; attempt++) {
        console.log(
          `\nRetry attempt ${attempt}/${retryAttempts} for all failed downloads`
        );
        const stillFailed = [];

        for (const failed of failedDownloads) {
          console.log(
            `\nRetrying video ${failed.videoCounter} (ID: ${failed.videoId})`
          );
          const success = await attemptDownload(
            failed.videoUrl,
            failed.videoId,
            failed.videoCounter,
            1
          );
          if (success) {
            downloadCounter++;
            console.log(
              `Successfully downloaded video ${downloadCounter} (ID: ${failed.videoId})`
            );
          }
          if (!success) {
            stillFailed.push(failed);
          }
        }

        failedDownloads = stillFailed;
        if (failedDownloads.length === 0) {
          console.log("All failed downloads recovered successfully!");
          break;
        }

        if (attempt < retryAttempts && failedDownloads.length > 0) {
          console.log(`\nWaiting 5 seconds before next retry attempt...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    // Final summary
    if (failedDownloads.length > 0) {
      console.log("\nFinal Failed Downloads Summary:");
      console.log(`Total failed downloads: ${failedDownloads.length}`);
      console.log(`Successfully downloaded: ${downloadCounter} videos`);
      failedDownloads.forEach(({ videoCounter, videoId, error }) => {
        console.log(`Video ${videoCounter} (ID: ${videoId}): ${error}`);
      });
    } else {
      console.log(`\nAll ${downloadCounter} videos downloaded successfully!`);
    }

    await browser.close();
    console.log("Browser closed");

    return {
      responses,
      failedDownloads,
      successfulDownloads: Array.from(successfulDownloads),
    };
  } catch (error) {
    console.log("error at runPuppeteer", error.message);
    throw new Error(error.message);
  }
}

// replace @realrafay with your tiktok username
const response = await runPuppeteer("https://www.tiktok.com/@realrafay");
fs.writeFileSync("test.json", JSON.stringify(response, null, 2));
