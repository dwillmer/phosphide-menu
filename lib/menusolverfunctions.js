/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';
var phosphor_menus_1 = require('phosphor-menus');
/**
 * Flattens a shallow-nested array-of-arrays into a single array
 * with all elements.
 *
 * #### Examples
 * ```typescript
 * var data = [[1],[2],[3,4]];
 * shallowFlatten(data); // [1,2,3,4]
 * ```
 * or with strings:
 * ```typescript
 * var data = [['a'],['b'],['c','d']];
 * shallowFlatten(data); // ['a','b','c','d']
 * ```
 *
 * #### Notes
 * This runs in `O(n)` time.
 *
 * This is called `shallowFlatten` because it will not flatten arrays
 * to arbitrary levels of nesting, this only works 2 levels deep. This
 * is sufficient for topsort as we're only dealing with edge lists.
 */
function shallowFlatten(nested) {
    return [].concat.apply([], nested);
}
exports.shallowFlatten = shallowFlatten;
/**
 * When combined with filter, returns the unique items in a flattened array.
 *
 * #### Examples
 * ```typescript
 * var data = [1,2,3,1];
 * testData.filter(unique); // [1,2,3]
 * ```
 */
function unique(val, i, self) {
    return self.indexOf(val) === i;
}
exports.unique = unique;
/**
 * Takes an item and returns the location with the item attached as 'menuItem'
 */
var itemTranspose = function (item) {
    var ret = item.location;
    ret.menuItem = item;
    return ret;
};
/**
 * Takes a transposed menu item and builds a phosphor MenuItem object for
 * direct use in the menus.
 */
var buildItem = function (item) {
    return new phosphor_menus_1.MenuItem({
        text: item[item.length - 1],
        shortcut: item.menuItem.shortcut
    });
};
/**
 * Builds a phosphor submenu (an array of menu items inside a Menu object)
 * from the items passed in and the text string for this MenuItem.
 */
var buildSubmenu = function (items, text) {
    var menuObj = new phosphor_menus_1.Menu();
    menuObj.items = items;
    return new phosphor_menus_1.MenuItem({ text: text, submenu: menuObj });
};
var sortItems = function (obj) { obj.sort(); return obj; };
/**
 *
 * #### Notes
 * This currently iterates over the items array twice; once for the map
 * and once for the filter. It would be nice to reduce this to a single
 * iteration, if we can do it without obscuring what's really going on.
 */
var getItemsAtLevel = function (items, level) {
    var num = level.length;
    return items
        .map(function (val) {
        // TODO : fix the .toString's below - only required for array equality.
        var vloc = val.location;
        if ((vloc.length > num) && (vloc.slice(0, num).toString() === level.toString())) {
            vloc.menuItem = val;
            return vloc;
        }
    })
        .filter(function (val) { return val !== undefined; });
};
/**
 * Tests whether the initial values in the given item match the ones in the
 * prefix argument. Essentially 'is this menu item in this part of the tree?'.
 */
var matchesPrefix = function (prefix, item) {
    return item.length >= prefix.length && item.slice(0, prefix.length).toString() === prefix.toString();
};
/**
 * TODO!
 */
var itemForConstraint = function (prefix, item) {
    return item.slice(prefix.length - 1, prefix.length)[0];
};
/**
 * Returns items that are in 'first' but not 'second' array. This is not symmetric.
 */
var difference = function (first, second) {
    return first.filter(function (i) { return second.indexOf(i) < 0; });
};
/**
 * Returns the constraints as an unordered array of directed edges for the objects
 * in the level of the tree at 'prefix', for every item in 'items'.
 */
var getConstraints = function (items, prefix) {
    var constraints = [];
    var allItems = [];
    for (var i = 0; i < items.length; ++i) {
        if (matchesPrefix(prefix, items[i])) {
            var itemName = items[i][prefix.length];
            allItems.push(itemName);
            // work out which item in this part of the tree is required.
            var consItem = itemForConstraint(prefix, items[i]);
            // pull out the constraints for that item.
            // allCons will be undefined if there's no constraints declared
            // for this item.
            var allCons = ((items[i]).menuItem).constraints;
            if (allCons && allCons[consItem]) {
                // now we have an array of constraints, actually constrain them
                // and push them onto the constraints var above.
                allCons[consItem].map(function (c) {
                    constraints.push(c.constrain(itemName));
                });
            }
        }
    }
    // The constraints array is now the list of edges defined by the constraints
    // on this menu system. However it does not take care of items which are in
    // the menu system, but are unconstrained.
    // In order to have a reliable, consistent mechanism for forming menus, we
    // therefore find all the items which have no constraints defined, and use
    // their position in the menu declaration to define their constraints.
    // This allows the user to only define constraints for the first item, and 
    // the rest will automatically fall into place, if defined in the required
    // order.
    var flattened = shallowFlatten(constraints);
    var allConstrained = flattened.filter(unique);
    var unconstrained = difference(allItems, allConstrained);
    unconstrained.sort();
    for (var i = 0; i < unconstrained.length - 1; i++) {
        constraints.push([unconstrained[i], unconstrained[i + 1]]);
    }
    // TODO : do this properly - should be based on position defined.
    return constraints;
};
/**
 * Takes a list of IMenuItems and a prefix and returns a fully formed menu for
 * all objects below that tree level.
 */
function partialSolve(items, prefix) {
    var menuItems = [];
    var levelItems = getItemsAtLevel(items, prefix);
    // TODO : don't need to sort at every level, can just sort once in the top
    // call
    sortItems(levelItems);
    var startIdx = 0;
    var endIdx = 0;
    var preLen = prefix.length;
    while (endIdx < levelItems.length) {
        var currentVal = levelItems[startIdx];
        // This is the real centre of the menu solver - 
        // if the prefix passed in is one less than the location length, then this
        // is a leaf node, so we build a menu item and push it onto the array (order
        // solving is done later). If the location length is longer than (prefix
        // length +1), then this is an intermediate node which has its own submenu.
        // In the latter case we recursively call partialSolve with a new prefix
        // containing the intermediate level.
        // That partialSolve clearly returns a built menu with the items at theat level,
        // so we just append that to our current array.
        if (levelItems[endIdx].length === preLen + 1) {
            menuItems.push(buildItem(levelItems[endIdx]));
            endIdx++;
            startIdx = endIdx;
        }
        else {
            // iterate over all the items at this level in the tree
            // take prefix length, use that as index into levelItems[endIdx]
            var match = levelItems[endIdx][preLen];
            while (levelItems[endIdx] && levelItems[endIdx][preLen] === match) {
                endIdx++;
            }
            var subItems = levelItems.slice(startIdx, endIdx).map(function (val) {
                return val.menuItem;
            });
            var submenu = partialSolve(subItems, currentVal.slice(0, preLen + 1));
            var menuObj = buildSubmenu(submenu, currentVal[preLen]);
            menuItems.push(menuObj);
            startIdx = endIdx;
            endIdx++;
        }
    }
    // At this point we have a fully formed menu for the 'prefix' level in the tree.
    // All we do now is sort based on the constraints given for all menu items
    // *at this level or below*.
    // var order = toposort<string>(getConstraints(levelItems, prefix));
    return menuItems;
}
exports.partialSolve = partialSolve;
//# sourceMappingURL=menusolverfunctions.js.map