/*
	Протестировано в последних FF, Chrome, IE11

    Определяю для работы приложения маленький фреймворк.
    Приложение будет включать в себя классы вьюх (абстрактные - Component, ListView и конкретные - Page, InstagramListView)
    А также несколько сервисных классов или функций

    Application - основной высокоуровневый класс приложения, который знает что и как надо рендерить,
    а также является хабом необходимых сервисов
 */

+function(global) {
	
var Application, Storage, TemplateMgr, Component, Page, ListView, InstagramListView, GridRendererActor, ListRendererActor;

global.Application = Application = function() {
    this.storage   = new Storage();
    this.templates = new TemplateMgr(this);

    this.init();
};

Application.prototype.tree = {
    type: 'page',
    tpl: 'instagram-page-tpl',
    children: [{
        type: 'InstagramListView',
        tpl: 'instagram-listview-tpl',
        childtype: 'component',
        childtpl: 'instagram-element-tpl'
    }]
};

Application.prototype.init = function() {
    this.page = this._createPage().render();
    this.list = this.page.child;

    this.storage.getJSON('instagram-data', this._onRecordsReady.bind(this));
};

Application.prototype._onRecordsReady = function(records) {
    this.list.clearElements();
    this.list.addElements(this._convertToRecords(records));
};

Application.prototype._convertToRecords = function(response) {
    var data = response.data || [];
    var records = [];

    for(var i = 0; i < data.length; i++) {
        var d = data[i];
        try {
            records.push({
                id: d.id,
                icon_url: 'resources/img/' + d.user.profile_picture,
                nickname: d.user.username,
                fullname: d.user.full_name,
                //можно сделать нормальное вычисление и поменять форматирование с часов на дату (и верстку тоже придется менять)
                //но нет
                timestamp: (Math.floor(Math.random() * 16) + 1) + 'h',
                image: 'resources/img/' + d.images.standard_resolution.url,
                likes_counter: d.likes.count,
                text: d.caption && d.caption.text || "<em>нет текста</em>"
            });
        } catch(e) {
            console.log('Чтение данных элемента провалилось: ' + d.id);
        }
    }

    return records;
};

Application.prototype._createPage = function() {
    Component.factory.contextapp = this;
    var page = Component.factory(this.tree);
    Component.factory.contextapp = null;
    return page;
};

Application.prototype.destroy = function() {
    this.page.destroy();
    this.page = null;
    this.list = null;

    this.storage.destroy();
    this.templates.destroy();
};

/*
 Helper-функции
 */

var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

extend = function(dest, src) {
    for(var key in src) {
        dest[key] = src;
    }
};

debounced = function(f, ms, scope) {
    var timer = null;

    return function() {
        var args = arguments;
        if(timer) {
            clearTimeout(timer);
        }

        timer = setTimeout(function() {
            f.apply(scope, args);
            timer = null;
        });
    }
};

parentEl = function(element, classname) {
    do {
        if(element.classList.contains(classname)) return element;
    }
    while(element = element.parentElement);
};

firstElementChild = function(element) {
    element = element.firstChild;
    do {
        if(element.nodeType == Node.ELEMENT_NODE) return element;
    } while(element = element.nextSibling);
}

/**
 * Менеджер шаблонов. Шаблоны хранятся в html файле внутри блоков script text/x-template
 * Менеджер компилирует шаблоны, и рендерит их в строку с переданными данными
 * @param app
 * @constructor
 */
TemplateMgr = function(app) {
    this.storage = app.storage;
    this.__compiled = Object.create(null);

    this.compileRegex = /{%\w+%}/mgi;
};

TemplateMgr.prototype.render = function(templateName, data) {
    data = data || {};

    if(!this.__compiled[templateName]) {
        return this.compile(templateName)(data);
    }

    return this.__compiled[templateName](data);
};

TemplateMgr.prototype.compile = function(templateName, data) {
    var tpltext = this.storage.getTemplate(templateName);
    if(!tpltext) throw new Error('No known template with name ' + templateName)

    var out = [], re = this.compileRegex, match, lastIndex = 0, norm = this._normalize;

    while((match = re.exec(tpltext)) != null) {
        out.push('"' + norm(tpltext.substring(lastIndex, match.index)) + '"');
        out.push('(data.' + match[0].slice(2, -2) + ' || "")');
        lastIndex = match.index + match[0].length;
    }

    out.push('"' + norm(tpltext.substr(lastIndex)) + '";');

    return this.__compiled[templateName] = new Function('data', 'return ' + out.join(' + '));
};

TemplateMgr.prototype._normalize = function(str) {
    return str.replace(/\"/g, '\\"').replace(/\s+/g, ' ');
};

TemplateMgr.prototype.destroy = function() {
    this.storage = null;
    this.__compiled = null;
};

/**
 * Класс для абстагирования от конкретных реализаций транспортов данных
 * Приложение запрашивает объект Storage чтобы получать данные,
 * он уже отправляет http запросы, или берет данные из кеша (можно добавить поддержку localStorage/indexedDB)
 * @param app
 * @constructor
 */

global.Storage = Storage = function () {
    this.cached = Object.create(Storage.globalres);
    this.resurl = Object.create(Storage.globalurl);
};

Storage.prototype.getTemplate = function(templateId) {
    var node = document.getElementById(templateId);
    if(node.nodeName.toUpperCase() != 'SCRIPT' || node.type != 'text/x-template') return null;

    return node.innerText;
};

Storage.prototype.getJSON = function(jsonId, onReady, onError) {
    if(this.cached['json' + jsonId]) {
        onReady(this.cached['json' + jsonId]);
    }

    if(this.resurl['json' + jsonId]) {
        this._fetch(this.resurl['json' + jsonId], onReady, onError);
    }
};

Storage.prototype._fetch = function(url, onReady, onError) {
    //TODO
    //в своем решении делать поддержку HTTP не стал, т.к. время поджимало
};

Storage.prototype.setResource = function(resId, data) {
    this.cached[resId] = data;
};

Storage.prototype.setResourceUrl = function(resId, url) {
    this.resurl[resId] = url;
};

Storage.prototype.destroy = function() {
    this.cached = null;
    this.resurl = null;
};

Storage.globalres = Object.create(null);
Storage.globalurl = Object.create(null);

Storage.registerResource = function(resId, data) {
    this.globalres[resId] = data;
};

Storage.registerUrl = function(resId, url) {
    this.globalurl[resId] = url;
};

/**
 * Базовый класс для визуального компонента
 *
 * При помощи Component.factory можно собрать дерево готовых объектов за один вызов.
 * Затем необходимо сделать вызов render, чтобы компонент сгенерировал свою верстку в documentFragment
 * В некоторых случаях было бы удобно рендериться в offscreenElement, чтобы получить размеры, но не показывать элемент.
 * Затем необходимо вызвать attach, чтобы элемент вставился в точку монтирования родительского элемента.
 *
 * Корневой элемент Page монтируется в document.body, и таким образом приложение что-то показывает.
 * @param app
 * @param props
 * @constructor
 */

Component = function(app, props) {
    props = props || {};

    this.id  = props._id;
    this.app = app;
    this.data = props.data || null;
    this.templateId = props.templateId;
    this.child = null;
    this.parent = null;
    this.rendered = false;
    this._docFrag = document.createDocumentFragment();
    this._divEl   = document.createElement('DIV');
    this.el = null;
    this.mountEl = null;
};

Component.prototype.render = function() {
    if(this.rendered) {
        return this.update();
    }

    var frag = this._docFrag, tmp = this._divEl, child;

    tmp.innerHTML = this.app.templates.render(this.templateId, this.data);

    while ( child = firstElementChild(tmp)) {
        frag.appendChild(child);
    }

    this.el = this._retreiveEl();
    this.mountEl = this._retreiveMountEl();

    if(this.child) {
        this.child.render();
    }

    this.rendered = true;

    return this;
};

Component.prototype._retreiveEl = function() {
    return firstElementChild(this._docFrag);
};

Component.prototype._retreiveMountEl = function() {
    var el = firstElementChild(this._docFrag);
    return el.className.indexOf('mount-el') == -1 ? (el.getElementsByClassName('mount-el') || [])[0] : el;
};

/**
 * После изначального рендера, при обновлении данных не обязательно все перерендеривать,
 * этот метод подразумевался как абстрактный, конкретные реализации сами определяют как им проще всего обновиться
 * без полного ререндера
 */
Component.prototype.update = function() {

};

Component.prototype.setData = function(data) {
    if(!data) return;
    this.data = data;
    this.render();
};

Component.prototype.setChild = function(child) {
    this.child = child;
    child.parent = this;

    return child;
};

Component.prototype.setParent = function(parent) {
    parent.setChild(this);
    this.attach(parent);

    return parent;
};

Component.prototype.attach = function(parent) {
    parent = parent || this.parent;
    if(parent && parent.rendered && this.rendered) {
        parent.mountEl.appendChild(this.el);
    }
};

Component.prototype.detach = function() {
    this.el && this.el.parentNode && this.el.parentNode.removeChild(this.el);
};

Component.prototype.destroy = function() {
};

Object.defineProperty(Component.prototype, 'children', {
    get: function() {
        return this.child ? [this.child] : []
    }
});

Component.factory = function(config) {
    var root = this._factoryCreateComponent(config);
    var children = config.children || [];

    for(var i = 0; i < children.length; i++) {
        var cmp = this.factory(children[i]);
        root.setChild(cmp);
    }

    return root;
};

Component.factory.contextapp = null;

Component._factoryCreateComponent = function(config) {
    var ctor = this.factoryGetCtor(config.type || '__noctor');
    return new ctor(this.factory.contextapp, this._factoryCreateProps(config));
};

Component.factoryGetCtor = function(type) {
    var typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    if(NS[type] instanceof Function) {
        return NS[type];
    } else if(NS[typeCapitalized] instanceof Function) {
        return NS[typeCapitalized];
    }
};

Component._factoryCreateProps = function(config) {
    return {
        templateId: config.tpl,
        childTemplateId: config.childtpl,
        childType: config.childtype,
        data: config.data
    };
};

/**
 * Страница - root-элемент в дереве компонентов, представляет всю страницу приложения
 * @param app
 * @param props
 * @constructor
 */
Page = function(app, props) {
    Component.call(this, app, props);
};

Page.prototype = Object.create(Component.prototype);
Page.prototype.constructor = Page;

Page.prototype.render = function() {
    Component.prototype.render.call(this);
    this.attach();

    return this;
};

Page.prototype.attach = function() {
    if(!this.rendered) return;
    this._attachRecursive(this.children);
    document.body.appendChild(this.el);
};

Page.prototype.detach = function() {
    document.body.removeChild(this.el);
};

Page.prototype._attachRecursive = function(children) {
    for(var i = 0; i < children.length; i++) {
        this._attachRecursive(children[i].children);
        children[i].attach();
    }
};

/**
 * Список элементов
 * @param app
 * @param props
 * @param actors
 * @constructor
 */
ListView = function(app, props, actors) {
    var data = props.data;
    delete props.data;
    Component.call(this, app, props);

    this._idprop = 'id';
    this.children = [];
    this.childTemplateId = props.childTemplateId;
    this.childType = props.childType;
    this.data = [];
    this.renderActors = actors || [];

    if(data && data.length) {
        this.addElements(data);
    }
};

ListView.prototype = Object.create(Component.prototype);
ListView.prototype.constructor = ListView;
ListView._idcounter = 0;

ListView.prototype.addChild = function(child, at) {
    if(at == undefined) {
        this.children.push(child);
    } else {
        this.children.splice(at, 0, child);
    }

    child.parent = this;

    return child;
};

ListView.prototype.setChild = ListView.prototype.addChild;

ListView.prototype.render = function() {
    Component.prototype.render.call(this);

    this._activateActors();
    for(var i = 0; i < this.children.length; i++) {
        this.children[i].render();
    }

    this._handleActors(this.children);

    return this;
};

/**
 * Actors представляют собой дополнительную стратегию, которую нужно применить при рендеринге
 * @private
 */
ListView.prototype._activateActors = function() {
    var toactivate = [], todeactivate = [];
    var me = this;

    for(var i = 0; i < this.renderActors.length; i++) {
        var actor = this.renderActors[i];
        var isactive = actor.isactive;
        if(actor.testactive() !== isactive) {
            isactive ? todeactivate.push(actor) : toactivate.push(actor);
        }
    }

    todeactivate.forEach(function(actor) {actor.deactivate.call(me), actor.isactive = false});
    toactivate.forEach(function(actor) {actor.activate.call(me), actor.isactive = true;});
};

ListView.prototype._handleActors = function(childrenElements) {
    var me = this;
    this.renderActors
        .filter(function(actor) {return actor.isactive})
        .forEach(function(actor) {
            actor.handle.call(me, childrenElements)
        });
};

ListView.prototype._activateAndHandleActors = function() {
    this._activateActors();
    this._handleActors(this.children);
};

/**
 * Метод для добавления новых дочерних компонентов на основе record-ов с данными
 * @param elementsData
 * @param at
 */
ListView.prototype.addElements = function(elementsData, at) {
    if(!at) {
        at = 0;
    }

    Component.factory.contextapp = this.app;
    var newchildren = [];

    for(var i = 0; i < elementsData.length; i++) {
        if(!elementsData[i][this._idprop]) {
            elementsData[i][this._idprop] = ++ListView._idcounter + '__listview_el';
        }

        this.data.splice(at + i, 0, elementsData[i]);
        var child = this.addChild(Component.factory({
            type: this.childType,
            tpl: this.childTemplateId,
            data: elementsData[i],
            children: elementsData[i].children
        }), at + i);

        child.render().attach();
        newchildren.push(child);
    }

    this._handleActors(newchildren);

    Component.factory.contextapp = null;
};

/**
 * Удаление
 * @param elementsData
 * @param at
 */
ListView.prototype.removeElements = function(elementsData, at) {
    if(typeof elementsData == 'number') {
        this.data.splice(at, elementsData);
        var removed = this.children.splice(at, elementsData);

        for(var i = 0; i < removed.length; i++) {
            removed.detach();
            removed.destroy();
        }
    } else {
        if(!(elementsData instanceof Array)) {
            elementsData = [elementsData];
        }

        for(var i = 0; i < elementsData.length; i++) {
            var id = elementsData[this._idprop];
            this._removeById(id);
        }
    }
};

ListView.prototype._removeById = function(id) {
    this.removeElements(1, this.getIndexById(id));
};

ListView.prototype.getById = function(id) {
    return this.children[this.getIndexById(id)];
};

ListView.prototype.getIndexById = function(id) {
    var d = this.data, idp = this._idprop;
    for(var i = 0; i < d.length; i++) {
        if(d[i][idp] == id) {
            return i;
        }
    }
};

/**
 * Очистка
 */
ListView.prototype.clearElements = function() {
    var removed = this.children;
    for(var i = 0; i < removed.length; i++) {
        removed.detach();
        removed.destroy();
    }

    this.data = [];
    this.children = [];
};

Object.defineProperty(ListView.prototype, 'children', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: null
});

/**
 * Список элементов - конкретная реализация списка элементов.
 * Здесь также обрабатываются события клика, и адаптивность при изменении размера окна.
 * @param app
 * @param props
 * @param actors
 * @constructor
 */
InstagramListView = function(app, props) {
    ListView.call(this, app, props, [GridRendererActor, ListRendererActor]);

    this.onClick = this.onClick.bind(this);
    window.addEventListener('resize', this.onResize = debounced(this._activateAndHandleActors, 200, this));
};

InstagramListView.prototype = Object.create(ListView.prototype);
InstagramListView.prototype.constructor = InstagramListView;

InstagramListView.prototype.render = function() {
    ListView.prototype.render.call(this);

    this.el.addEventListener('click', this.onClick);
};

InstagramListView.prototype.onClick = function(e) {
    if(!e.target.classList.contains('instagram-el-content-likes')) return;
    var cmp = this.getById(parentEl(e.target, 'listview-element').id);
    alert("Элемент " + cmp.data.id + " (" + cmp.data.text.substr(0, 15) + "...)");
};

InstagramListView.prototype.destroy = function() {
    window.removeEventListener('resize', this.onResize);
    this.el.removeEventListener('click', this.onClick);
};

/**
 * Я не стал полностью завязываться на media queries для адаптивности, т.к. такой метод плохо расширяется
 * В зависимости от того как реализовывать сеточный layout, нам могли бы потребоваться дополнительные операции в JS
 *
 * Такой вариант невозможно реализовать на CSS-only, требуется вручную рассчитывать XY-координаты каждого
 * дочернего элемента, и затем применять их либо через transform, либо через position-absolute
 * -------------
 * | 1 | 2 | 3 |
 * -------------
 * | 4 | 5 | 6 |
 * -------------
 *
 *
 * Такой вариант можно реализовать через CSS, что и сделано ниже (он проще)
 * -------------
 * | 1 | 3 | 5 |
 * -------------
 * | 2 | 4 | 6 |
 * -------------
 *
 * Actors - реализация стратегии рендеринга, она может быть активирована, и тогда будет перехватывать
 * операции с добавлением/удалением дочерних элементов, и делать свои какие-то дополнительные операции.
 *
 * В данном случае ничего сложного делать не нужно, но если бы реализовывался первый вариант сетки,
 * тут было бы много дополнительного кода.
 */

GridRendererActor = {
    isactive: false,
    testactive: function() {
        return document.body.clientWidth < 1024
    },
    activate: function() {
        this.el.classList.add('grid-layout');
    },
    deactivate: function() {
        this.el.classList.remove('grid-layout');
    },
    handle: function(children) {
        /* баг Firefox с page-break-inside: avoid (воспроизводится 59.0.1)
        - почему-то каждый resize разная разбивка на колонки, в результате чего страница мелькает
        - попробуйте закомментировать содержимое и поресайзить страницу*/
        if(!isFirefox) return;
        if(this.el.clientWidth == 600) {
            !this.el.style.height && (this.el.style.height = this.el.clientHeight + 'px');
        } else if(this.el.style.height) {
            this.el.style.height = '';
        }
    }
};

ListRendererActor = {
    isactive: false,
    testactive: function() {
        return document.body.clientWidth >= 1024
    },
    activate: function() {
        this.el.classList.add('list-layout');
    },
    deactivate: function() {
        this.el.classList.remove('list-layout');
    },
    handle: function(children) {

    }
};

var NS = {
	Component: Component,
	Page: Page,
	ListView: ListView,
	InstagramListView: InstagramListView
};

}(window);