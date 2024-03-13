let lang = 'es';
const isMobile = window.matchMedia('(max-width: 767px)').matches;

const iframe = document.querySelector('#wiki');
let endArticle, startArticle, currentArticle, startTime, endTime;
let breadcrumb = [];

const loadingElem = document.querySelector('#loading')
const startLoading = () => loadingElem.classList.remove('hide');
const endLoading = () => loadingElem.classList.add('hide');

const getArticle = (title) => {
    startLoading();

    const path = isMobile ? 'mobile-html' : 'html';

    return fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/${path}/${title}`)
        .then(response => {
            if (response.status === 404) {
                throw new Error('404 Not Found');
            }

            return response.text();
        })
        .then(content => {
            const redirectMatch = content.match('<link rel="mw:PageProp/redirect" href="./([^"]*)"');
            if (redirectMatch) {
                return getArticle(redirectMatch[1]);
            }

            let parsedContent = content;
            parsedContent = parsedContent.replace('<base href', '<base nohref');
            parsedContent = parsedContent.replace('/w/load.php', `https://${lang}.wikipedia.org/w/load.php`);

            const titleMatch = content.match('<link rel="dc:isVersionOf" href="\/\/\\w*\.wikipedia.org\/wiki\/([^"]*)"');

            if (!titleMatch) {
                throw new Error('Not An Article');
            }

            return {
                pageId: content.match('<meta property="mw:pageId" content="(\\d*)"')[1],
                title: decodeURIComponent(titleMatch[1]),
                content: parsedContent,
            };
        });
};
const navigateArticle = (title) => {
    console.info('Navigating', title);
    getArticle(title).then(article => {
        refreshBreadcrumb(article);

        iframe.contentWindow.document.close();
        iframe.contentWindow.document.write(article.content);
        setTimeout(() => {
            if (!isMobile) {
                iframe.contentWindow.document.body.style = 'padding: 10px; font-family: -apple-system, "system-ui", "Segoe UI", Roboto, Lato, Helvetica, Arial, sans-serif';
            }
            iframe.scrollTo(0, 0);

            endLoading();
        }, 250);
        iframe.contentWindow.document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        iframe.contentWindow.document.addEventListener('auxclick', (event) => {
            event.preventDefault();
        });
        iframe.contentWindow.document.addEventListener('click', (event) => {
            const anchorTarget = event.composedPath().find(elem => elem.tagName === 'A');
            if (!anchorTarget) {
                return;
            }

            event.preventDefault();

            const href = anchorTarget.getAttribute('href');

            const isRef = href.startsWith(`./${article.title}`) && href.includes('#');
            if (isRef) {
                iframe.contentWindow.document.location.href = href.substring(href.indexOf('#'));
                return;
            }

            if (href.substring(0, 2) === './') {
                navigateArticle(href.substring(2));
            } else {
                // Not wikipedia article
                document.querySelector('#error').classList.remove('hide');
                setTimeout(() => {
                    document.querySelector('#error').classList.add('hide');
                }, 500);
            }
        });

        currentArticle = unCleanName(article.title);
        checkWinner();
    });
};

const unCleanName = title => title.replace(/ /g, '_');
const cleanName = title => title.replace(/_/g, ' ');

const refreshBreadcrumb = (newArticle) => {
    if (newArticle) {
        breadcrumb.push(newArticle);
    }

    const elemBreadcrumb = document.querySelector('#breadcrumb');

    elemBreadcrumb.innerHTML = '';
    breadcrumb.slice(1).forEach((article) => {
        let name = cleanName(article.title);
        elemBreadcrumb.insertAdjacentHTML('beforeend', `<li class="breadcrumb-item">${name}</li>`);
    });

    document.querySelector('#articleCount').innerHTML = breadcrumb.length - 1;
};

const checkWinner = () => {
    if (currentArticle === endArticle) {
        document.querySelector('#winner').classList.remove('hide');

        endTime = new Date().valueOf();
    }
};

const getRandomTitle = () => {
    return fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/random/title`)
        .then(response => response.json())
        .then(({items}) => {
            return items[0].title;
        });
};

const startGame = (start, end) => {
    navigateArticle(start);

    startArticle = unCleanName(start);
    endArticle = unCleanName(end);

    let params = new URLSearchParams({
        lang: lang,
        start: startArticle,
        end: endArticle,
    });
    window.history.replaceState({}, '', '?' + params.toString());

    document.querySelector('#endArticleName').innerHTML = cleanName(end);
    document.querySelector('#startArticleName').innerHTML = cleanName(start);

    document.querySelector('#toggleBreadcrumb').addEventListener('click', () => {
        document.querySelector('#breadcrumb').classList.toggle('d-none');
    });

    startTime = new Date().valueOf();
    setInterval(() => {
        const time = (endTime || new Date().valueOf()) - startTime;
        const diffIsBiggerThanHour = time > 3600000;
        document.querySelector('#clock').innerHTML = new Date(time).toISOString().substring(diffIsBiggerThanHour ? 11 : 14, 19);
    }, 1);
};

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);

    if (params.has('lang')) {
        lang = params.get('lang');
        document.getElementsByTagName('html')[0].setAttribute('lang', lang);
    }

    if (params.has('start') && params.has('end')) {
        startGame(params.get('start'), params.get('end'));
        return;
    }

    Promise.all([
        getRandomTitle(),
        getRandomTitle(),
    ]).then(([start, end]) => {
        if (start === end) {
            location.reload();
            return;
        }

        startGame(start, end);
    });
});

window.addEventListener('beforeunload', (event) => {
    if (currentArticle === startArticle) {
        return;
    }

    const confirmationMessage = 'Si te vas perdés todo.';

    event.preventDefault();
    event.returnValue = confirmationMessage;
    return confirmationMessage;
});
