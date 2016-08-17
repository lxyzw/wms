(function ($, undefined) {
    var totalRowCount = AjaxGrid.totalRowCount,
            currentPage = 1,
            pageCount = AjaxGrid.pageCount,
            savedParams = {
                start: 0,
                itemsPerPage: AjaxGrid.itemsPerPage
            },
            unloadWarningSet = false,
            containerContext, gridContext, navigationContext;

    $.ajaxSetup({ cache: false });

    function reloadGrid(params) {
        if (params.start === undefined || (params.start >= 0 && params.start < totalRowCount)) {
            if (!unloadWarningSet || confirm('You have unsaved changes. Are you sure you want to reload the grid?')) {
                unloadWarningSet = false;
                $(window).unbind('beforeunload');

                $.extend(savedParams, params);
                currentPage = Math.floor(savedParams.start / savedParams.itemsPerPage) + 1;
                savedParams.start = (currentPage - 1) * savedParams.itemsPerPage;

                return $.get(AjaxGrid.GridDataGetUrl, savedParams).done(function (rows, status, xhr) {
                    gridContext.find('tbody').html(rows);
                    totalRowCount = Math.floor(xhr.getResponseHeader('X-Total-Row-Count'));
                    pageCount = Math.ceil(totalRowCount / savedParams.itemsPerPage);

                    gridContext.find('td').filter(':last-child').removeClass('hidden');
                    navigationContext.find('input.pageNum').val(currentPage);
                    navigationContext.find('span.pageCount').html(pageCount);
                    navigationContext.find('.itemsPerPage select').val(savedParams.itemsPerPage);

                    if (currentPage === 1) {
                        navigationContext.find('a.prev, a.begin').each(disableLink);
                    } else {
                        navigationContext.find('span.prev, span.begin').each(enableLink);
                    }
                    if (currentPage === pageCount) {
                        navigationContext.find('a.next, a.end').each(disableLink);
                    } else {
                        navigationContext.find('span.next, span.end').each(enableLink);
                    }
                });
            }
        }
        return $.Deferred().reject();
    }

    function reorderByColumn(clickedArrow) {
        var reloadParams = {
            start: 0,
            orderBy: $(clickedArrow).parent().data('column-name'),
            desc: $(clickedArrow).is('.uparrow')
        };
        reloadGrid(reloadParams).done(function () {
            gridContext.find('span.uparrow, span.downarrow').each(enableLink);
            disableLink.call(clickedArrow);
        });
    }

    function createRow(row) {
        var postParams = getPostParams(row);
        $.post(AjaxGrid.CreatePostUrl, postParams)
                .done(function (newRow) {
                    row.replaceWith(newRow);
                    totalRowCount++;
                    clearUnloadWarning();
                })
                .fail(function () {
                    row.addClass('error');
                });
    }

    function makeRowEditable(row) {
        $.get(AjaxGrid.EditGetUrl.replace(/__ID__/, row.data('pkey')), function (editableRow) {
            row.replaceWith(editableRow);
        });
        setUnloadWarning();
    }

    function editRow(row) {
        var postParams = getPostParams(row);
        postParams.push({ name: 'ID', value: row.data('pkey') });
        $.post(AjaxGrid.EditPostUrl.replace(/__ID__/, row.data('pkey')), postParams)
                .done(function (newRow) {
                    row.replaceWith(newRow);
                    clearUnloadWarning();
                })
                .fail(function () {
                    row.addClass('error');
                });
    }

    function deleteRow(row) {
        if (confirm('Are you sure you want to delete this row?')) {
            $.post(AjaxGrid.DeletePostUrl.replace(/__ID__/, row.data('pkey')))
                    .done(function () {
                        row.remove();
                        totalRowCount--;
                    })
                    .fail(function () {
                        alert('Row deletion failed.');
                    });
        }
    }

    function disableLink() {
        var elem = $(this),
                classes = elem.attr('class'),
                href = elem.attr('href'),
                html = elem.html();
        elem.replaceWith($('<span data-href="' + href + '" class="' + classes + '">' + html + '</span>'));
    }

    function enableLink() {
        var elem = $(this),
                classes = elem.attr('class'),
                href = elem.data('href'),
                html = elem.html();
        elem.replaceWith($('<a href="' + href + '" class="' + classes + '">' + html + '</a>'));
    }

    function getPostParams(row) {
        return row.find(':input[name]:not(:disabled)').filter(':not(:checkbox), :checked').map(function () {
            var input = $(this);
            return { name: input.attr('name'), value: input.val() };
        }).get();
    }

    function setUnloadWarning() {
        if (!unloadWarningSet) {
            unloadWarningSet = true;
            $(window).bind('beforeunload', function () {
                return 'You have unsaved changes. Are you sure you want to leave?';
            });
        }
    }

    function clearUnloadWarning() {
        gridContext.find('td').filter(':last-child').removeClass('hidden');
        if (unloadWarningSet && $('.createRow, .editRow').length === 0) {
            unloadWarningSet = false;
            $(window).unbind('beforeunload');
        }
    }

    $(function () {
        containerContext = $('#AjaxGridContainer');
        gridContext = containerContext.find('#AjaxGrid');
        navigationContext = containerContext.find('.AjaxGridNavigation');

        containerContext.find('.insertEmptyRow').removeClass('hidden');
        navigationContext.find('input.pageNum').removeClass('hidden');
        navigationContext.find('.itemsPerPage').removeClass('hidden');
        navigationContext.find('span.pageNum').addClass('hidden');
        gridContext.find('th span.reorder').each(enableLink);
        gridContext.find('tr > *').filter(':last-child').removeClass('hidden');

        navigationContext.delegate('a.prev', 'click', function (e) {
            reloadGrid({ start: savedParams.start - savedParams.itemsPerPage });
            e.preventDefault();
        });
        navigationContext.delegate('a.next', 'click', function (e) {
            reloadGrid({ start: savedParams.start + savedParams.itemsPerPage });
            e.preventDefault();
        });
        navigationContext.delegate('a.begin', 'click', function (e) {
            reloadGrid({ start: 0 });
            e.preventDefault();
        });
        navigationContext.delegate('a.end', 'click', function (e) {
            reloadGrid({ start: (pageCount - 1) * savedParams.itemsPerPage });
            e.preventDefault();
        });
        navigationContext.find('a.refresh').click(function (e) {
            reloadGrid({});
            e.preventDefault();
        });

        navigationContext.find('input.pageNum')
                .keyup(function (e) {
                    if (e.keyCode === 13) {
                        $(this).blur();
                    }
                })
                .blur(function () {
                    var newPageNum = Number($(this).val());
                    if (newPageNum >= 1 && newPageNum <= pageCount) {
                        reloadGrid({ start: (newPageNum - 1) * savedParams.itemsPerPage });
                    } else {
                        $(this).val(currentPage);
                    }
                });

        navigationContext.find('.itemsPerPage select').change(function () {
            reloadGrid({ itemsPerPage: Number($(this).val()) });
        });

        gridContext.delegate('thead a.uparrow, thead a.downarrow', 'click', function (e) {
            reorderByColumn(this);
            e.preventDefault();
        });
        gridContext.find('thead a.reorder').click(function (e) {
            var th = $(this).parent(),
                    arrow = th.find('a.downarrow');
            if (arrow.length === 0) {
                arrow = th.find('a.uparrow');
            }
            reorderByColumn(arrow[0]);
            e.preventDefault();
        });

        $('.insertEmptyRow').click(function (e) {

            $.get(AjaxGrid.CreateGetUrl, function (emptyRow) {
                //gridContext.find('tbody').prepend(emptyRow); 
                gridContext.find('thead + tbody').prepend(emptyRow);
            });
            setUnloadWarning();
            e.preventDefault();
        });
        gridContext.delegate('.createRow', 'click', function () {
            createRow($(this).parents('tr'));
        });
        gridContext.delegate('.cancelCreateRow', 'click', function () {
            $(this).parents('tr').remove();
            clearUnloadWarning();
        });

        gridContext.delegate('.makeRowEditable', 'click', function (e) {
            makeRowEditable($(this).parents('tr'));
            e.preventDefault();
        });
        gridContext.delegate('.editRow', 'click', function () {
            editRow($(this).parents('tr'));
        });
        gridContext.delegate('.cancelEditRow', 'click', function () {
            var row = $(this).parents('tr');
            $.get(AjaxGrid.GridDataGetUrl.replace(/__ID__/, row.data('pkey')), function (newRow) {
                row.replaceWith(newRow);
                clearUnloadWarning();
            });
        });

        gridContext.delegate('.deleteRow', 'click', function (e) {
            deleteRow($(this).parents('tr').eq(0));
            e.preventDefault();
        });
    });
})(jQuery);