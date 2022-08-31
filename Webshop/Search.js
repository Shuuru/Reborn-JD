/**
 * Since all items are obtained dynamically through ajax, on page load we need to generate array
 * containing all items so on user search we can search through local-memory instead of calling
 * via ajax for every cat, subcat combination for every single user letter typed.
 */

let SearchBarHelpers = {
    //Exact name option for O(1) searching
    allStoreItemsByName: {},
    //Approximate name option for O(n) searching
    allStoreItemsByIndex: [],
    searchTerm: false,
    currentlySearching: false,
    originalCat: 1,
    originalSubCat: 1,
    currentCat: 1,
    currentSubCat: 1,
    lastTimeSearched: new Date(),
    lastTermSearched: "",
    currentlyThrottled: false,
    currentlyDrawing: false,
    getShopRowFromItemSpan: (span, rowId) => {
        return span.parent().parent().parent().parent().eq(rowId);
    },
    setItemRowBackgroundColor: (span, rowId, color) => {
        return SearchBarHelpers.getShopRowFromItemSpan(span, rowId).css('background-color', color);
    },
    showItemHandler: (cat, subcat, searchTerm) => {    
        SearchBarHelpers.showSearchFeedback(false);   
            
        let repeatUntilNotLocked = setInterval(() => {
            if (lock == 0) {
                SearchBarHelpers.lastTermSearched = searchTerm;
                show_shop_cat(cat, subcat);
                clearInterval(repeatUntilNotLocked);
            }
        }, 100);
    },
    getAllStoreItems: () => {
        for (const cat in SUBCATS) {
            for (const subcat in SUBCATS[cat]) {
                $.ajax({
                    type: "POST",
                    url: "./ajax.php",
                    data: {
                        order: 2,
                        cat1: cat,
                        cat2: subcat
                    },
                    dataType: "JSON"
                })
                .done(function(json) {
                    json.items.forEach((item) => {
                        //Save first occurrence of an item only
                        let itemObject = SearchBarHelpers.allStoreItemsByName[item.item_name.trim().toUpperCase()];
                        if(typeof itemObject == "undefined")
                            itemObject = item;

                        SearchBarHelpers.allStoreItemsByIndex.push(item);
                    });

                    //Sort array to prefer returning items earlier in the shop (lower cat, subcat)
                    SearchBarHelpers.allStoreItemsByIndex.sort((a, b) => {
                       if(a.cat !== b.cat)
                            return a.cat - b.cat;
                        else
                            return a.subcat - b.subcat;
                    });

                });
            }
        }
    },
    drawStore: () => {
        //If no character has been chosen, do nothing
        if(SearchBarHelpers.getCharacterId() == 0)
            return;

        SearchBarHelpers.searchTerm = $('#searchInput').val().trim().toUpperCase();

        //If beginning to search, store what tab user is currently in to restore them here if they erase everything
        if (!SearchBarHelpers.currentlySearching) {
            SearchBarHelpers.currentlySearching = true;
            //Get current active cat/subcat values
            SearchBarHelpers.originalCat = $('.choose_cat.active').eq(1).data("cat");
            SearchBarHelpers.originalSubCat = $('.choose_cat.active').eq(1).data("subcat");
        }

        if (SearchBarHelpers.searchTerm && SearchBarHelpers.searchTerm.length > 0) {
            //If currently in an ajax request, it means the store is drawing, so we will not
            //Ask for it to re-draw at this moment, instead we'll try again in 200ms
            if (SearchBarHelpers.currentlyDrawing)
                return SearchBarHelpers.callDrawStoreAfterDelay();

            //Add a 200ms delay between searches for quick typers to not re-query too often
            let currentTime = new Date();
            if ((currentTime - SearchBarHelpers.lastTimeSearched < 200 || SearchBarHelpers.currentlyDrawing) && (SearchBarHelpers.searchTerm !== SearchBarHelpers.lastTermSearched)) {
                SearchBarHelpers.currentlyThrottled = true;

                return SearchBarHelpers.callDrawStoreAfterDelay();
            } 
            else {
                SearchBarHelpers.currentlyThrottled = false;
                SearchBarHelpers.lastTimeSearched = currentTime;
            }

            let itemObject;

            //Find exact search in O(1)
            if (typeof SearchBarHelpers.allStoreItemsByName[SearchBarHelpers.searchTerm] !== "undefined") {
                itemObject = SearchBarHelpers.allStoreItemsByName[SearchBarHelpers.searchTerm];
            }
            //Find approximate search in O(n)
            else {
                for (item of SearchBarHelpers.allStoreItemsByIndex) {

                    if (item && item.item_name && item.item_name.trim().toUpperCase().includes(SearchBarHelpers.searchTerm)) {
                        itemObject = item;
                        break;
                    }
                }
            }

            //Show item by highlighting if in current page, or change page and then highlight
            if(itemObject) {
                let sameCats = SearchBarHelpers.setNewCats(itemObject.cat, itemObject.subcat);

                if (sameCats)
                    SearchBarHelpers.updateRowHighlighting();
                else
                    SearchBarHelpers.showItemHandler(item.cat, item.subcat, SearchBarHelpers.searchTerm);
            }
            /**
             * Item is not found, so we'll restore shop view and show a simple, non-obtrusive message saying no item found
             */
            else {
                SearchBarHelpers.revertShopView();
                SearchBarHelpers.showSearchFeedback(true);
            }
        }
        //Default to before-search tab
        else {
            SearchBarHelpers.revertShopView();
            SearchBarHelpers.showSearchFeedback(false);
            SearchBarHelpers.currentlySearching = false;
        }
    },
    updateRowHighlighting: () => {
        //Only do this while searching and not for other miscellaneous ajax requests
        let itemArray = $('.item > .text > span');
        if (SearchBarHelpers.searchTerm && SearchBarHelpers.searchTerm.length > 0 && SearchBarHelpers.currentlySearching) {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                if (SearchBarHelpers.searchTerm && SearchBarHelpers.searchTerm.length > 0 && itemArray[itemArrayIterator].innerHTML.trim().toUpperCase().includes(SearchBarHelpers.searchTerm))
                    SearchBarHelpers.setItemRowBackgroundColor(itemArray, itemArrayIterator, 'rgb(255, 255, 0, 0.25)');
                else
                    SearchBarHelpers.setItemRowBackgroundColor(itemArray, itemArrayIterator, '');
            }
        }
        //Reset all coloring
        else {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                SearchBarHelpers.setItemRowBackgroundColor(itemArray, itemArrayIterator, '');
            }
        }
    },
    //Originally, this was supposed to revert to before-search view, but it's more intuitive to take back to 1, 1
    revertShopView: () => {
        // SearchBarHelpers.originalCat, SearchBarHelpers.originalSubCat
        let sameCats = SearchBarHelpers.setNewCats("1", "1");

        if(!sameCats)
            SearchBarHelpers.showItemHandler("1", "1", "");
        else
            SearchBarHelpers.updateRowHighlighting();
    },
    setNewCats: (newCat, newSubCat) => {
        let sameCats = SearchBarHelpers.currentCat == newCat && SearchBarHelpers.currentSubCat == newSubCat;

        SearchBarHelpers.currentCat = newCat;
        SearchBarHelpers.currentSubCat = newSubCat;

        return sameCats;
    },
    getCharacterId: () => {
        return parseInt($('#target_character').val());
    },
    showSearchFeedback: (show) => {
        $('#searchResultFeedback').css('visibility', (show ? 'visible' : 'hidden'));
    },
    callDrawStoreAfterDelay: () => {
        return setTimeout(() => {
            SearchBarHelpers.drawStore();
        }, 200);
    }
}

//Function to show only items matching search term
let drawStore = () => {
    SearchBarHelpers.drawStore();
}

let InitStoreSearch = () => {
    SearchBarHelpers.getAllStoreItems();

    //Add search after last shop category
    $('.account-block-tabs > li:last-child')
        .after(
            `<div style="padding-left: 100px;padding-bottom: 1px;">` +
                `<div style="display: table-cell; background: #eee; color: #777; padding: 0 12px; border-radius: 4px 0px 0px 4px;">Search</div>` +
                `<div style="display: table-cell;">` +
                    `<input type="text" id="searchInput" style="width: 200px;border: 0;display: block;padding: 8px;border-radius: 0px 4px 4px 0px;" class="role_sel" oninput="drawStore()">` +
                `</div>` +
            `</div>`
        );
    
    //Add search feedback above search box
    $('.account-block-tabs')
        .before('<div style="visibility: hidden;margin-top:0px;">' +
                    '<span id="searchResultFeedback" style="float:right; color:red">No item found with that name!</span>' +
                '</div>'
        );

    $(document).ajaxStart(function() {
        SearchBarHelpers.currentlyDrawing = true;
    });
    
    $(document).ajaxStop(function() {
        SearchBarHelpers.currentlyDrawing = false;
    });
    
    $(document).ajaxComplete(function() {
        //Re-draw store if user typed during last draw
        if (SearchBarHelpers.currentlyThrottled && SearchBarHelpers.currentlySearching && !SearchBarHelpers.currentlyDrawing)
            SearchBarHelpers.drawStore();

        SearchBarHelpers.updateRowHighlighting();

        SearchBarHelpers.currentlyDrawing = false;
    });
}

//Call this in the document ready function
InitStoreSearch();
