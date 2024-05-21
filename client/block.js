'use strict';
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  expandableTitleStates: Ember.computed.alias('block._state.expandableTitleStates'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  init() {
    if (!this.get('block._state')) {
      this.set('block._state', {});
      this.set('block._state.expandableTitleStates', {});
    }

    this._super(...arguments);
  },
  actions: {
    toggleExpandableTitle: function (index, type) {
      this.set(
        `block._state.expandableTitleStates`,
        Object.assign({}, this.get('block._state.expandableTitleStates'), {
          [type]: Object.assign(
            {},
            this.get('block._state.expandableTitleStates')[type],
            {
              [index]: !(
                this.get('block._state.expandableTitleStates')[type] &&
                this.get('block._state.expandableTitleStates')[type][index]
              )
            }
          )
        })
      );

      this.get('block').notifyPropertyChange('data');
    }
  }
});
