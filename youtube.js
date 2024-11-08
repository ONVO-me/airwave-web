
let fetch;

(async () => {
    fetch = (await import('node-fetch')).default;
})();


const scrap = async (url, agent = 'chrome') => {
    let agents = {
        chrome: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        ios: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        android: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
    }
    return fetch(url, {
        headers: agents[agent],
        redirect: 'follow',
    });
}


function filterYoutube(json) {
    const core = json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents

    let tracks = [];
    let data = []

    core.forEach(component => {
        try {
            data = data.concat(component.itemSectionRenderer?.contents || []);
        } catch (e) {
            console.log(e)
        }
    });

    data.forEach(video => {
        try {
            tracks.push({
                api: 'youtube',
                id: video.videoRenderer.videoId,
                poster: video.videoRenderer.thumbnail.thumbnails[0].url,
                title: video.videoRenderer.title.runs[0].text,
                artist: video.videoRenderer.ownerText.runs[0].text,
            })
        } catch (e) {
            // console.log(e)
        }
    })

    return tracks
}

async function getVideoId(req, res) {
    const { q } = req.query
    try {
        const json = await scrapYoutube(`https://www.youtube.com/results?search_query=${q}`)
        const data = filterYoutube(json)
        if (data.length == 0) {
            throw new Error('error yt')
        }
        res.json({id: data[0].id})
    } catch (e) {
        console.log(e)
        res.json({ error: e })
    }

}

function filterYoutubeScrap(textData) {
    const ytInitialDataRegex = /var ytInitialData = (.*?);<\/script>/s;
    const match = textData.match(ytInitialDataRegex);

    if (match && match[1]) {
        return JSON.parse(match[1]);
    } else {
        return { error: 'no_data' }
    }
}

async function scrapYoutube(url, e) {
    try {
        const response = await scrap(url)
        let textData = await response.text();
        if (!e) {
            textData = filterYoutubeScrap(textData)
        }
        return textData
    } catch (e) {
        console.log(e)
        return { error: 'call_error' }
    }
}


const getYoutubeList = async (req) => {
    try {
        const json = await scrapYoutube(`https://www.youtube.com/playlist?list=${req.query.id}`)
        let tracks = []

        const core = json.contents
            ?.twoColumnBrowseResultsRenderer
            ?.tabs?.[0]
            ?.tabRenderer
            ?.content
            ?.sectionListRenderer
            ?.contents?.[0]
            ?.itemSectionRenderer
            ?.contents?.[0]
            ?.playlistVideoListRenderer
            ?.contents;

        core.forEach(video => {
            try {
                tracks.push({
                    api: 'youtube',
                    id: video.playlistVideoRenderer.videoId,
                    poster: video.playlistVideoRenderer.thumbnail.thumbnails[0].url,
                    title: video.playlistVideoRenderer.title.runs[0].text,
                    artist: video.playlistVideoRenderer.shortBylineText.runs[0].text,
                    artist_id: video.playlistVideoRenderer?.shortBylineText.runs?.[0].browseEndpoint?.browseId,
                })
            } catch (e) {

            }
        });

        const data = {
            api: 'youtube',
            owner: {
                id: json.header?.playlistHeaderRenderer?.ownerText.runs[0]?.navigationEndpoint?.browseEndpoint?.browseId,
                name: json.header?.playlistHeaderRenderer?.ownerText.runs[0]?.text,
                image: tracks[0]?.poster
            },
            name: json.header?.playlistHeaderRenderer?.title?.simpleText,
            description: json.header?.playlistHeaderRenderer?.descriptionText,
            tracks_count: json.header?.playlistHeaderRenderer?.numVideosText.runs[0].text,
            tracks: tracks,
            url: json.header?.playlistHeaderRenderer?.ownerText.runs[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl,
        }

        return data
    } catch (e) {
        return { error: e.toString() }
    }
}



function filterYoutubeMusicScrap(textData) {
    const regex = /data: '(.*?)'}\);/gs;
    const matches = [];
    let match;

    while ((match = regex.exec(textData)) !== null) {
        const extractedData = match[1].replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        matches.push(extractedData);
    }

    if (matches.length > 0) {
        return matches
    } else {
        return [];
    }
}

// const getYotuubeMusicList = async (req, res) => {
//     const url = decodeURIComponent(req.query.url)
//     const response = await scrap(url)
//     const html = await response.text();
//     const data = filterYoutubeScrap(html)
//     res.send(data)
// }

const getYotubeMusicList = async (req, res) => {
    try {
        const url = `https://music.youtube.com/playlist?list=${req.query.id}`
        const response = await scrap(url);
        const html = await response.text();
        const main = filterYoutubeMusicScrap(html);
        const rawData = JSON.parse(main[1])
        // const metaData = JSON.parse(main[0])

        // console.log('scraping')

        const playlistId = rawData.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.playlistId;
        const trackItems = rawData.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.contents;
        const playlistTitle = rawData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer.title.runs[0].text;
        const owner = rawData.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
        const ownerName = owner?.straplineTextOne?.runs?.[0]?.text
        const ownerID = owner?.straplineTextOne?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
        const ownerImage = owner?.straplineThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails[1]?.url;

        const tracks = trackItems.map(item => {
            const renderer = item.musicResponsiveListItemRenderer;

            const title = renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
            const artist = renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
            const videoId = renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId;

            const durationText = renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.accessibilityPlayData?.accessibilityData?.label || '';

            const durationMatch = durationText.match(/(\d+) minutes, (\d+) seconds/);
            let durationMs = 0;
            if (durationMatch) {
                const minutes = parseInt(durationMatch[1], 10);
                const seconds = parseInt(durationMatch[2], 10);
                durationMs = (minutes * 60 + seconds) * 1000;
            } else {
                durationMs = null
            }

            const poster = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[0].url;
            const posterLarge = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1] ? renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1].url : poster;

            return {
                api: 'youtube',
                poster,
                posterLarge,
                title,
                artist,
                id: videoId,
                duration: durationMs
            };
        });

        const data = {
            id: playlistId,
            api: 'youtube',
            name: playlistTitle,
            owner: {
                id: ownerID,
                name: ownerName,
                image: ownerImage
            },
            tracks_count: tracks.length,
            tracks
        };

        res.json(data);
    } catch (e) {
        res.json({ error: e.message })
    }
};



module.exports = {
    getYotubeMusicList,
    scrapYoutube,
    getVideoId,
    getYoutubeList,
    filterYoutube
}