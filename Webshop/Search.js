/**
 * Since all items are obtained dynamically through ajax, on page load we need to generate array
 * containing all items so on user search we can search through local-memory instead of calling
 * via ajax for every cat, subcat combination for every single user letter typed.
 */
//Exact name option for O(1) searching
let allStoreItemsByName = [];
//Approximate name option for O(n) searching
let allStoreItemsByIndex = [];
//Get all items to store in local array on page load only
function getAllStoreItems() {
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
                //If the item shows up in multiple places, the object location will be overriden, but it doesn't really matter
                //We're trying to find a specific item so it's not really important to the user in which cat/subcat pair we find it
                json.items.forEach((item) => {
                    allStoreItemsByName[item.item_name.trim().toUpperCase()] = item;
                    allStoreItemsByIndex.push(item);
                });
            });
        }
    }
}

//This should be inserted into the document ready function
getAllStoreItems();

//Add search div on top of store under character selector
$('.account-block-tabs').before(`<div><label for="searchInput" style="color: #606060; font-size: 14px">Search:</label><input type="text" id="searchInput" style="width:300px" class="role_sel" oninput="drawStore()"><span id="searchResultFeedback" style="color:red"></span></div>`);
let currentlySearching = false;
let searchTerm = "";
let storeCat1 = 1;
let storeCat2 = 1;
let lastTimeSearched = new Date();
let lastTermSearched = "";
let currentlyThrottled = false;
let currentlyDrawing = false;
//Function to show only items matching search term
function drawStore() {
    searchTerm = $('#searchInput').val().trim().toUpperCase();

    //If currently in an ajax request, it means the store is drawing, so we will not
    //Ask for it to re-draw at this moment, instead we'll try again in 200ms
    if (currentlyDrawing && lastTermSearched != searchTerm)
        return setTimeout(() => {
            drawStore();
        }, 200);
    //Add a 200ms delay between searches for quick typers to not re-query too often
    let currentTime = new Date();
    if (currentTime - lastTimeSearched < 200) {
        return currentlyThrottled = true;
    } else {
        currentlyThrottled = false;
        lastTimeSearched = currentTime;
    }
    //If beginning to search, store what tab user is currently in to restore them here if they erase everything
    if (!currentlySearching) {
        currentlySearching = true;
        //Get current active cat/subcat values
        storeCat1 = $('.choose_cat.active').eq(1).data("cat");
        storeCat2 = $('.choose_cat.active').eq(1).data("subcat");
    }
    if (searchTerm && searchTerm.length > 0) {
        //Find exact search in O(1)
        if (typeof allStoreItemsByName[searchTerm] !== "undefined") {
            showItemHandler(allStoreItemsByName[searchTerm].cat, allStoreItemsByName[searchTerm].subcat, searchTerm);
        }
        //Find approximate search in O(n)
        else {
            let checkedItems = 0;
            for (item of allStoreItemsByIndex) {
                checkedItems++;
                if (item && item.item_name && item.item_name.trim().toUpperCase().includes(searchTerm)) {
                    showItemHandler(item.cat, item.subcat, searchTerm);
                    break;
                }
                //If on final check, item is not found, we'll default to before-search tab for now
                //And a simple, non-obtrusive message saying no item found
                if (checkedItems == allStoreItemsByIndex.length) {
                    showItemHandler(storeCat1, storeCat2, "");
                    $('#searchResultFeedback').html("No item found with that name!");
                }
            }
        }
    }
    //Default to before-search tab
    else {
        showItemHandler(storeCat1, storeCat2, "");
        $('#searchResultFeedback').html("");
        currentlySearching = false;
    }
}

function showItemHandler(cat, subcat, currentSearchTerm) {
    if (currentSearchTerm && currentSearchTerm.length > 0)
        $('#searchResultFeedback').html("");
    let repeatUntilNotLocked = setInterval(() => {
        if (lock == 0) {
            lastTermSearched = currentSearchTerm;
            show_shop_cat(cat, subcat);
            clearInterval(repeatUntilNotLocked);
        }
    }, 100);
}

$(document).ajaxStart(function() {
    currentlyDrawing = true;
});

$(document).ajaxStop(function() {
    currentlyDrawing = false;
});

$(document).ajaxComplete(function() {
    currentlyDrawing = false;
    if (currentlyThrottled)
        return drawStore(true);
    setTimeout(() => {
        //Only do this while searching and not for other miscellaneous ajax requests
        let itemArray = $('.item > .text > span');
        if (searchTerm && searchTerm.length > 0 && currentlySearching) {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                if (searchTerm && searchTerm.length > 0 && itemArray[itemArrayIterator].innerHTML.trim().toUpperCase().includes(searchTerm))
                    itemArray.parent().parent().parent().parent().eq(itemArrayIterator).css('background-color', 'yellow');
                else
                    itemArray.parent().parent().parent().parent().eq(itemArrayIterator).css('background-color', '');
            }
        }
        //Reset all coloring
        else {
            for (let itemArrayIterator = 0; itemArrayIterator < itemArray.length; itemArrayIterator++) {
                itemArray.parent().parent().parent().parent().eq(itemArrayIterator).css('background-color', '');
            }
        }
    }, 10);
});
