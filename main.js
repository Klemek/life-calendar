/* exported app */

const cookies = {
    /**
     * Save a value in a cookie
     * @param {string} name
     * @param {string} value
     * @param {number | undefined} days
     */
    set: function (name, value, days = undefined) {
        const maxAge = !days ? undefined : days * 864e2;
        document.cookie = `${name}=${encodeURIComponent(value)}${maxAge ? `;max-age=${maxAge};` : ''}`;
    },
    /**
     * Get a value from a cookie
     * @param {string} name
     * @return {string} value from cookie or empty if not found
     */
    get: function (name) {
        return document.cookie.split('; ').reduce(function (r, v) {
            const parts = v.split('=');
            return parts[0] === name ? decodeURIComponent(parts[1]) : r;
        }, '');
    },
    /**
     * Delete a cookie
     * @param {string} name
     */
    delete: function (name) {
        this.set(name, '', -1);
    },
    /**
     * Clear all cookies
     */
    clear: function () {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        }
    },
};

Date.prototype.addDays = function(days) {
    const date = new Date(this.getTime());
    date.setDate(this.getDate() + parseInt(days));
    return date;
};

Date.prototype.getWeek = function() {
    const oneJan = new Date(this.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((this - oneJan) / (24 * 60 * 60 * 1000));
    return Math.ceil(( this.getDay() + 1 + numberOfDays) / 7);
};

Date.prototype.formatSimple = function() {
    return `${this.getFullYear()}-${('00' + (this.getMonth() + 1)).substr(-2)}-${('00' + this.getDate()).substr(-2)}`;
};

Object.prototype.clone = function() {
    return JSON.parse(JSON.stringify(this));
};

const COLOR_PALETTE = [
    '#F44336',
    '#E91E63',
    '#9C27B0',
    '#673AB7',
    '#3F51B5',
    '#2196F3',
    '#03A9F4',
    '#00BCD4',
    '#009688',
    '#4CAF50',
    '#8BC34A',
    '#CDDC39',
    '#FDD835',
    '#FFC107',
    '#FF9800',
    '#FF5722',
    '#795548',
];

const selectColor = {
    props: [ 'modelValue' ],
    data: function () {
        return {
            colorPalette: COLOR_PALETTE,
        };
    },
    emits: [ 'update:modelValue' ],
    template: `
  <select class="select-color" v-bind:value="modelValue" v-on:input="$emit('update:modelValue', $event.target.value)" v-bind:style="{'background-color':colorPalette[modelValue]}">
      <option v-for="(color, i) in colorPalette" v-bind:value="i" v-bind:style="{'background-color':color}">Color {{i + 1}}</option>
  </select>
  `,
};

const NEW_PERIOD = {
    color: '',
    startDate: '',
    endDate: '',
    text: '',
};

const serialize = function(birtdate, view, events, views) {
    return LZString.compressToBase64(JSON.stringify([ birtdate, view, events.map(event => [ event.color, event.date, event.text, event.display ? 1 : 0 ]), views.map(view => [ view.name, view.periods.map(period => [ period.color, period.startDate, period.endDate, period.text ]) ]) ]));
};

const deserialize = function(rawData) {
    const data = JSON.parse(LZString.decompressFromBase64(rawData));
    return {
        birthdate: data[0],
        view: data[1],
        events: data[2].map(subData => {
            return {
                color: subData[0],
                date: subData[1],
                text: subData[2],
                display: subData[3] === 1,
            };
        }),
        views: data[3].map(subData1 => {
            return {
                name: subData1[0],
                periods: subData1[1].map(subData2 => {
                    return {
                        color: subData2[0],
                        startDate: subData2[1],
                        endDate: subData2[2],
                        text: subData2[3],
                    };
                }),
                newPeriod: NEW_PERIOD.clone(),
            };
        }),
    };
};

let app = {
    data() {
        return {
            life: [],
            birth: '1996-07-25',
            view: '',
            newEvent: {
                color: '',
                date: '',
                text: '',
                display: true,
            },
            events: [],
            views: [],
        };
    },
    computed: {
        birthdate() {
            return new Date(this.birth);
        },
    },
    methods: {
        showApp() {
            document.getElementById('app').setAttribute('style', '');
        },
        getDate(row, col) {
            return new Date(this.birthdate.getFullYear() + row, this.birthdate.getMonth(), this.birthdate.getDate()).addDays(col * 7);
        },
        getEvents(row, col) {
            const startDate = this.getDate(row, col);
            const endDate = startDate.addDays(7);
            const strStartDate = startDate.formatSimple();
            const strEndDate = endDate.formatSimple();
            return this.events.concat(
                [
                    {
                        type: 'special',
                        color: null,
                        date: this.birth,
                        text: 'Birth',
                        display: true,
                    },
                    {
                        type: 'special',
                        color: null,
                        date: new Date().formatSimple(),
                        text: 'Today',
                        display: true,
                    },
                ],
            ).filter(event => event.display && event.date >= strStartDate && event.date < strEndDate);
        },
        getViews(row, col) {
            const strStartDate = this.getDate(row, col).formatSimple();
            const strNow = (new Date()).formatSimple();
            const out = {};
            this.views.forEach(view => {
                const extract = view.periods.filter(period => period.startDate <= strStartDate && (!period.endDate && strStartDate <= strNow || period.endDate > strStartDate));
                if (extract.length) {
                    out[view.name] = extract[0];
                }
            });
            return out;
        },
        getTooltip(row, col) {
            const date = this.getDate(row, col);
            let text = `${date.getFullYear()} (Week ${date.getWeek()})<br>Age: ${row}`;
            const views = this.getViews(row, col);
            for (const view in views) {
                text += `<br>${view}: ${views[view].text} (${views[view].percent})`;
            }
            this.getEvents(row, col).forEach(event => {
                text += `<br>- ${new Date(event.date).formatSimple()}: ${event.text}`;
            });
            return text;
        },
        getColor(row, col) {
            const events = this.getEvents(row, col);
            for (const i in events) {
                if (events[i].type === 'special') {
                    return events[i].color;
                }
            }
            if (!this.view) {
                if (events.length > 0) {
                    return events[0].color;
                }
            } else {
                const views = this.getViews(row, col);
                if (views[this.view]) {
                    return views[this.view].color;
                }
            }
            return undefined;
        },
        getStyle(row, col) {
            const color = this.getColor(row, col);
            return {
                'background-color': color ? COLOR_PALETTE[color] : (color === null ? '#212121' : null),
                'border-color': color ? COLOR_PALETTE[color] : (color === null ? '#212121' : null),
            };
        },
        deleteEvent(eventIndex) {
            this.events.pop(eventIndex);
        },
        addEvent() {
            if (this.newEvent.color && this.newEvent.text && this.newEvent.date) {
                this.events.push(this.newEvent.clone());
            }
        },
        deleteView(viewIndex) {
            this.views.pop(viewIndex);
        },
        addView() {
            this.views.push({
                name: 'New View',
                periods: [],
                newPeriod: NEW_PERIOD.clone(),
            });
        },
        deletePeriod(viewIndex, periodIndex) {
            this.views[viewIndex].periods.pop(periodIndex);
        },
        addPeriod(viewIndex) {
            if (this.views[viewIndex].newPeriod.color && this.views[viewIndex].newPeriod.text && this.views[viewIndex].newPeriod.startDate) {
                this.views[viewIndex].periods.push(this.views[viewIndex].newPeriod.clone());
                this.views[viewIndex].newPeriod.startDate = this.views[viewIndex].newPeriod.endDate;
                this.views[viewIndex].newPeriod.endDate = '';
            }
        },
        reset() {
            this.view = '';
            this.events = [];
            this.views = [];
            this.$force;
        },
        updateStatistics() {
            const total = (new Date() - this.birthdate);
            this.views.forEach(view => {
                console.log(view);
                const data = {};
                view.periods.forEach(period => {
                    data[period.text + period.color] = (data[period.text + period.color] ?? 0) + ((period.endDate ? new Date(period.endDate) : new Date()) - (new Date(period.startDate)));
                });
                view.periods.forEach(period => {
                    period.percent = `${(100 * data[period.text + period.color] / total).toFixed(3)}%`;
                });
            });
        },
    },
    beforeMount() {
        this.life = Array(90).fill(Array(52));
        const url = new URL(window.location);
        if (url.searchParams.get('d')) {
            const data = deserialize(url.searchParams.get('d'));
            this.birtdate = data.birthdate;
            this.view = data.view;
            this.events = data.events;
            this.views = data.views;
        } else if (cookies.get('d')) {
            const data = deserialize(cookies.get('d'));
            this.birtdate = data.birthdate;
            this.view = data.view;
            this.events = data.events;
            this.views = data.views;
        }
        this.updateStatistics();
    },
    mounted() {
        setTimeout(this.showApp);
    },
    beforeUpdate() {
        this.updateStatistics();
    },
    updated() {
        const data = serialize(this.birtdate, this.view, this.events, this.views);
        const url = new URL(window.location);
        if (url.searchParams.get('d') !== data) {
            url.searchParams.set('d', data);
            window.history.pushState({}, '', url);
        }
        cookies.set('d', data);
    },
};

window.onload = () => {
    app = Vue.createApp(app);
    app.component('select-color', selectColor);
    app.mount('#app');
};
