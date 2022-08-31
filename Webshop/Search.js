/**
 * Since all items are obtained dynamically through ajax, on page load we need to generate array
 * containing all items so on user search we can search through local-memory instead of calling
 * via ajax for every cat, subcat combination for every single user letter typed.
 */

let SearchBarHelpers = {
    //Exact name option for O(1) searching
    allStoreItemsByName: [],
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
    GetShopRowFromItemSpan: (span, rowId) => {
        return span.parent().parent().parent().parent().eq(rowId);
    },
    showItemHandler: (cat, subcat, searchTerm) => {
        $('#searchResultFeedback').css('visibility', 'hidden');            
            
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
                }).done(function(json) {
                    json.items.forEach((item) => {
                        //Save first occurrence of an item only
                        if(typeof SearchBarHelpers.allStoreItemsByName[item.item_name.trim().toUpperCase()] == "undefined")
                            SearchBarHelpers.allStoreItemsByName[item.item_name.trim().toUpperCase()] = item;

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
                return setTimeout(() => {
                    SearchBarHelpers.drawStore();
                }, 200);

            //Add a 200ms delay between searches for quick typers to not re-query too often
            let currentTime = new Date();
            if ((currentTime - SearchBarHelpers.lastTimeSearched < 200 || SearchBarHelpers.currentlyDrawing) && (SearchBarHelpers.searchTerm !== SearchBarHelpers.lastTermSearched)) {
                SearchBarHelpers.currentlyThrottled = true;

                return setTimeout(() => {
                    SearchBarHelpers.drawStore();
                }, 200);
            } 
            else {
                SearchBarHelpers.currentlyThrottled = false;
                SearchBarHelpers.lastTimeSearched = currentTime;
            }

            //Find exact search in O(1)
            if (typeof SearchBarHelpers.allStoreItemsByName[SearchBarHelpers.searchTerm] !== "undefined") {
                let itemObject = SearchBarHelpers.allStoreItemsByName[SearchBarHelpers.searchTerm];

                let sameCats = SearchBarHelpers.setNewCats(itemObject.cat, itemObject.subcat);

                //If current page contains search text, highlight only
                if (sameCats)
                    SearchBarHelpers.updateRowHighlighting();
                else
                    SearchBarHelpers.showItemHandler(itemObject.cat, itemObject.subcat, SearchBarHelpers.searchTerm);
            }
            //Find approximate search in O(n)
            else {
                let checkedItems = 0;
                for (item of SearchBarHelpers.allStoreItemsByIndex) {
                    checkedItems++;

                    if (item && item.item_name && item.item_name.trim().toUpperCase().includes(SearchBarHelpers.searchTerm)) {
                        let sameCats = SearchBarHelpers.setNewCats(item.cat, item.subcat);

                        if (sameCats)
                            SearchBarHelpers.updateRowHighlighting();
                        else
                            SearchBarHelpers.showItemHandler(item.cat, item.subcat, SearchBarHelpers.searchTerm);

                        break;
                    }

                    //If on final check, item is not found, we'll default to before-search tab for now
                    //And a simple, non-obtrusive message saying no item found
                    if (checkedItems == SearchBarHelpers.allStoreItemsByIndex.length) {
                        SearchBarHelpers.revertShopView();
                        $('#searchResultFeedback').css('visibility', 'visible');
                    }
                }
            }
        }
        //Default to before-search tab
        else {
            SearchBarHelpers.revertShopView();
            $('#searchResultFeedback').css('visibility', 'hidden');
            SearchBarHelpers.currentlySearching = false;
        }
    },
    updateRowHighlighting: () => {
        //Only do this while searching and not for other miscellaneous ajax requests
        let itemArray = $('.item > .text > span');
        if (SearchBarHelpers.searchTerm && SearchBarHelpers.searchTerm.length > 0 && SearchBarHelpers.currentlySearching) {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                if (SearchBarHelpers.searchTerm && SearchBarHelpers.searchTerm.length > 0 && itemArray[itemArrayIterator].innerHTML.trim().toUpperCase().includes(SearchBarHelpers.searchTerm))
                    SearchBarHelpers.GetShopRowFromItemSpan(itemArray, itemArrayIterator).css('background-color', 'rgb(255, 255, 0, 0.25)');
                else
                    SearchBarHelpers.GetShopRowFromItemSpan(itemArray, itemArrayIterator).css('background-color', '');
            }
        }
        //Reset all coloring
        else {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                SearchBarHelpers.GetShopRowFromItemSpan(itemArray, itemArrayIterator).css('background-color', '');
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
