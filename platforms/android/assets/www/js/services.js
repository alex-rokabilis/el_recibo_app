angular.module('starter.services', [])
    .service('DB', function($ionicPlatform, $q) {
        var db;
        $ionicPlatform.ready(function() {
            db = window.sqlitePlugin.openDatabase({
                name: "my.db",
                location: 1
            });
            db.transaction(function(tx) {
                tx.executeSql('DROP TABLE IF EXISTS receipts');
                tx.executeSql('DROP TABLE IF EXISTS levels');
                tx.executeSql('DROP TABLE IF EXISTS categories');
                tx.executeSql('DROP TABLE IF EXISTS category_receipts');
                tx.executeSql('DROP TABLE IF EXISTS sync');

                tx.executeSql('CREATE TABLE IF NOT EXISTS receipts (id integer primary key,sid integer ,aa integer, afm text, eponimia text, poso REAL, printed_at DATETIME,image BLOB, deleted INTEGER NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT unqq UNIQUE (afm, aa))');
                tx.executeSql('CREATE TABLE IF NOT EXISTS levels (id integer primary key, start integer, end integer)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS sync (id integer primary key, synced_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS categories (id integer primary key,sid integer , name text UNIQUE,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS category_receipts (category_id integer NOT NULL, receipt_id integer NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT unq UNIQUE (category_id, receipt_id))');
                initialize_levels(tx);
                console.log('db created')
            }, function(e) {
                alert('Cant create DB' + e.message);
            })
        })

        function initialize_levels(tx) {
            tx.executeSql("SELECT COUNT(*) as count FROM levels", [],
                function(tx, res) {
                    if (db_result_to_array(res)[0].count == 0) next();
                },
                function(e) {});

            function next() {
                var toCollect = 5,
                    start = 0,
                    end = 5;
                for (var i = 1; i < 20; i++) {
                    if (i > 1) {
                        start = end;
                        toCollect = Math.floor(toCollect * 1.5);
                        end = start + toCollect;
                    }
                    tx.executeSql("INSERT INTO levels (id, start ,end) VALUES (?,?,?)", [i, start, end],
                        function(tx, res) {},
                        function(e) {
                            console.log('DB ERROR' + e.message)
                        });
                };
            }

        }

        function get_user_level() {
            var deferred = $q.defer();
            get_receipts_count()
                .then(function(count) {
                    db.transaction(function(tx) {
                        tx.executeSql("select id as level from levels WHERE start <= " + count + " AND end > " + count + ";", [], function(tx, results) {
                            deferred.resolve(results.rows.item(0).level);
                        }, function(e) {
                            deferred.reject(e);
                        });
                    });
                }).catch(function(e) {
                    alert(e);
                })
            return deferred.promise;

        }
        //categories SECTION
        function insert_category(category_name, category_sid) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("INSERT INTO categories " +
                    "(name,sid) VALUES (?,?)", [category_name, category_sid || null],
                    function(tx, results) {
                        deferred.resolve(results);
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function search_category(category_query) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM categories " +
                    "WHERE name LIKE '%" + category_query + "%'", [],
                    function(tx, results) {
                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function find_category_by_name(category_name) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT id FROM categories " +
                    "WHERE name = '" + category_name + "'", [],
                    function(tx, results) {
                        if (results.rows.length != 0) {
                            deferred.resolve(db_result_to_array(results)[0]);
                        } else {
                            deferred.resolve(null);
                        }
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function findOrCreate_category_by_name(category_query) {
            var deferred = $q.defer();
            find_category_by_name(category_query)
                .then(function(category) {
                    if (category) {
                        deferred.resolve(category.id);
                    } else {
                        insert_category(category_query)
                            .then(function(r) {
                                deferred.resolve(r.insertId);
                            })
                            .catch(deferred.reject);
                    }
                })
                .catch(deferred.reject);
            return deferred.promise;
        }

        function get_all_categories() {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM categories ", [],
                    function(tx, results) {
                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }
        function get_categories_count() {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT COUNT(*) as count FROM categories ", [],
                    function(tx, results) {
                        deferred.resolve(db_result_to_array(results)[0].count);
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function edit_category(category_id, new_name) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [new_name, category_id],
                    function(tx, results) {
                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function get_categories_from_receipt(receipt_id) {
            var deferred = $q.defer();
            console.log('pira id', receipt_id)
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM categories " +
                    "LEFT JOIN category_receipts ON category_id = categories.id " +
                    "WHERE receipt_id = ? AND deleted = 0", [receipt_id],
                    function(tx, results) {
                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function get_receipts_from_category(category_id) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM receipts " +
                    "LEFT JOIN category_receipts ON receipt_id = receipts.id " +
                    "WHERE category_id = ? AND deleted = 0", [category_id],
                    function(tx, results) {


                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function get_receipts_from_category_extended(category_id, date_past) {
            var deferred = $q.defer();
            if (!date_past) date_past = '-30 years';
            db.transaction(function(tx) {
                tx.executeSql("SELECT COUNT(id) as count, SUM(poso) as sum FROM receipts " +
                    "LEFT JOIN category_receipts ON receipt_id = receipts.id " +
                    "WHERE category_id = ? AND category_receipts.deleted = 0 AND receipts.deleted = 0 " +
                    "AND datetime(receipts.printed_at,'unixepoch','localtime') > datetime('now',?,'localtime')", [category_id, date_past],
                    function(tx, results) {
                        console.log('cat res::')
                        prettyLog(db_result_to_array(results));
                        deferred.resolve(db_result_to_array(results)[0]);
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function check_assign_receipt_to_category(receipt_id, category_id) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("UPDATE category_receipts SET deleted = 0, updated_at = CURRENT_TIMESTAMP " +
                    "WHERE receipt_id = ? AND category_id = ?;", [receipt_id, category_id],
                    function(tx, results) {
                        if (results.rowsAffected != 0)
                            deferred.resolve(results);
                        else
                            deferred.reject();
                    }, function(e) {
                        deferred.reject();
                    });
            });
            return deferred.promise;
        }

        function assign_receipt_to_category(receipt_id, category_id) {
            var deferred = $q.defer();
            check_assign_receipt_to_category(receipt_id, category_id)
                .then(deferred.resolve)
                .catch(function() {
                    db.transaction(function(tx) {
                        tx.executeSql("INSERT INTO category_receipts " +
                            "(receipt_id, category_id) VALUES (?, ?)", [receipt_id, category_id],
                            function(tx, results) {
                                deferred.resolve(results.rows);
                            }, function(e) {
                                deferred.reject(e);
                            });
                    });
                })

            return deferred.promise;


        }

        function assign_receipt_to_category_extended(receipt_sid, category_sid) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("INSERT INTO category_receipts " +
                    "(receipt_id, category_id) VALUES " +
                    "((SELECT id FROM receipts WHERE sid = ? ), (SELECT id FROM categories WHERE sid = ? ))", [receipt_sid, category_sid],
                    function(tx, results) {
                        console.log('assing!!!!')
                        prettyLog(results.rows)
                        deferred.resolve(results.rows);
                    }, function(e) {
                        deferred.reject(e);
                    });
            });


            return deferred.promise;


        }

        function delete_receipt_from_category(receipt_id, category_id) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("UPDATE category_receipts SET deleted = 1 " +
                    "WHERE receipt_id = ? AND category_id = ?", [receipt_id, category_id],
                    function(tx, results) {
                        deferred.resolve(results.rows);
                    }, function(e) {
                        deferred.reject(e);
                    });
            });
            return deferred.promise;
        }

        function delete_receipt_from_category_name(receipt_id, category_name) {
            var deferred = $q.defer();
            find_category_by_name(category_name)
                .then(function(category) {
                    if (!category) return deferred.resolve();
                    delete_receipt_from_category(receipt_id, category.id)
                        .then(deferred.resolve)
                        .catch(deferred.reject)
                })
                .catch(deferred.reject)
            return deferred.promise;
        }

        function insert_categories_and_assign(category_names, receipt_id) {
            if (!category_names instanceof Array) category_names = [category_names];

            category_names.forEach(function(category_name) {
                console.log('GOING FOR ')
                prettyLog(category_name)
                findOrCreate_category_by_name(category_name)
                    .then(function(category_id) {
                        console.log('ASSING ')
                        prettyLog(category_id)
                        console.log(receipt_id)
                        assign_receipt_to_category(receipt_id, category_id)
                            .then(prettyLog)
                    })
            })
        }

        

        function get_receipts_count() {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("select COUNT(id) as count from receipts WHERE deleted = 0;", [], function(tx, results) {
                    deferred.resolve(results.rows.item(0).count);
                });
            }, function(e) {
                deferred.reject(e);
            });
            return deferred.promise;
        }

        function get_receipts_sum() {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("select SUM(poso) as sum from receipts WHERE deleted = 0;", [], function(tx, results) {
                    deferred.resolve(results.rows.item(0).sum);
                });
            }, function(e) {
                deferred.reject(e);
            });
            return deferred.promise;
        }

        function get_receipts(offset, limit, orderBy, order) {
            console.log('GETTING RECEIPTS')
            if (!order) order = 'DESC';
            if (!orderBy) orderBy = 'id';
            if (!offset) offset = 0;
            if (!limit) limit = 10;
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("select * from receipts WHERE deleted = 0 ORDER BY " + orderBy + " " + order + "  LIMIT " + limit + " OFFSET " + offset + ";", [], function(tx, results) {

                    deferred.resolve(db_result_to_array(results));

                }, function(e) {
                    console.log('ourt')
                    console.log(JSON.stringify(e));
                    deferred.reject("Database error");
                });
            });
            return deferred.promise;
        }

        function get_receipt(receipt_id) {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("select * from receipts WHERE deleted = 0 AND id = " + receipt_id, [], function(tx, results) {

                    var receipt = db_result_to_array(results)[0];
                    get_categories_from_receipt(receipt.id)
                        .then(function(categories) {
                            receipt.categories = categories;
                            console.log(receipt.printed_at)
                            deferred.resolve({
                                id: receipt.id,
                                afm: Number(receipt.afm),
                                poso: Number(receipt.poso),
                                aa: receipt.aa,
                                image: receipt.image,
                                eponimia: receipt.eponimia,
                                printed_at: new Date(receipt.printed_at * 1000),
                                categories: receipt.categories.map(function(x) {
                                    return x.name;
                                })
                            });
                        })
                        .catch(function() {
                            deferred.resolve(receipt);
                        })

                }, function(e) {
                    console.log(JSON.stringify(e));
                    deferred.reject("Database error");
                });
            });
            return deferred.promise;
        }

        function check_save_receipt(receipt) {
            var deferred = $q.defer();

            db.transaction(function(tx) {

                tx.executeSql("UPDATE receipts " +
                    "SET deleted = 0 ,image = ? , updated_at = CURRENT_TIMESTAMP " +
                    "WHERE afm = ? AND aa = ? AND eponimia = ? AND " +
                    "poso = ? AND printed_at = ? ", [receipt.image,
                        receipt.afm,
                        receipt.aa,
                        receipt.eponimia,
                        receipt.poso,
                        dateToDB(receipt.printed_at)
                    ],
                    function(tx, res) {
                        console.log('???')
                        if (res.rowsAffected != 0)
                            deferred.resolve(res);
                        else
                            deferred.reject();
                    },
                    function(e) {
                        console.log("errrr" + JSON.stringify(e));
                        deferred.reject(e.message);
                    });
            });


            return deferred.promise;
        }

        function save_receipt(receipt) {
            console.log('pao gia save')
            var deferred = $q.defer();
            if (!receipt || !receipt.afm || !receipt.poso || !receipt.printed_at || !receipt.aa || !receipt.eponimia) {
                deferred.reject('Wrong Receipt');
                return deferred.promise;
            }
            console.log('pao gia check')
            check_save_receipt(receipt)
                .then(deferred.resolve)
                .catch(function() {
                    console.log('real save' + dateToDB(receipt.printed_at));
                    db.transaction(function(tx) {

                        tx.executeSql("INSERT INTO receipts (afm,aa,eponimia,poso,image,printed_at,sid) VALUES (?,?,?,?,?,?,?)", [
                                receipt.afm,
                                receipt.aa,
                                receipt.eponimia,
                                receipt.poso,
                                receipt.image || null,
                                dateToDB(receipt.printed_at),
                                receipt.sid || null
                            ],
                            function(tx, res) {
                                deferred.resolve(res);
                            },
                            function(e) {
                                console.log(JSON.stringify(e));
                                deferred.reject(e.message);
                            });
                    });
                })

            return deferred.promise;
        }

        function delete_receipt(receipt_id) {
            var deferred = $q.defer();


            db.transaction(function(tx) {

                tx.executeSql("UPDATE receipts " +
                    "SET deleted = 1 WHERE id = ?", [receipt_id],
                    function(tx, res) {
                        deferred.resolve(res);
                    },
                    function(e) {
                        console.log("errrr" + JSON.stringify(e));
                        deferred.reject(e.message);
                    });
            });
            db.transaction(function(tx) {
                tx.executeSql("UPDATE category_receipts SET deleted = 1 " +
                    "WHERE receipt_id = ?", [receipt_id],
                    function(tx, results) {
                        //deferred.resolve(results.rows);
                    }, function(e) {
                        //deferred.reject(e);
                    });
            });


            return deferred.promise;
        }



        function update_receipt(receipt) {
            var deferred = $q.defer();
            if (!receipt || !receipt.afm || !receipt.poso || !receipt.printed_at || !receipt.aa || !receipt.eponimia) {
                deferred.reject('Wrong Receipt');
                return deferred.promise;
            }
            db.transaction(function(tx) {
                tx.executeSql("UPDATE receipts " +
                    "SET afm = ?, aa = ?, eponimia = ?, " +
                    "poso = ?, image = ?, printed_at = ? , updated_at = CURRENT_TIMESTAMP " +
                    "WHERE id = ?", [receipt.afm,
                        receipt.aa,
                        receipt.eponimia,
                        receipt.poso,
                        receipt.image,
                        dateToDB(receipt.printed_at),
                        receipt.id
                    ],
                    function(tx, res) {
                        deferred.resolve(res);
                    },
                    function(e) {
                        console.log("errrr" + JSON.stringify(e));
                        deferred.reject(e.message);
                    });
            });




            return deferred.promise;
        }

        function get_synchronization() {
            var deferred = $q.defer();
            db.transaction(function(tx) {
                tx.executeSql("SELECT synced_time FROM sync", [],
                    function(tx, res) {
                        deferred.resolve(db_result_to_array(res)[0]);
                    },
                    function(e) {
                        console.log("errrr" + JSON.stringify(e));
                        deferred.reject(e.message);
                    });
            });
            return deferred.promise;
        }

        function set_synchronization() {
            var deferred = $q.defer();

            db.transaction(function(tx) {
                tx.executeSql("DELETE FROM sync", [],
                    function(tx, res) {
                        synchronize();
                    },
                    function(e) {
                        console.log("errrr" + JSON.stringify(e));
                        deferred.reject(e.message);
                    });
            });

            function synchronize() {
                db.transaction(function(tx) {
                    tx.executeSql("INSERT INTO sync (synced_time) VALUES (CURRENT_TIMESTAMP)", [],
                        function(tx, res) {
                            deferred.resolve();
                        },
                        function(e) {
                            console.log("errrr" + JSON.stringify(e));
                            deferred.reject(e.message);
                        });
                });
            }
            return deferred.promise;
        }

        function db_result_to_array(results) {
            var toReturn = [];
            var len = results.rows.length;
            for (var i = 0; i < len; i++) {
                toReturn.push(results.rows.item(i));
            }
            return toReturn;
        }

        function dateToDB(imerominia) {

            var x;
            if (!imerominia) imerominia = new Date();
            try {
                x = +(imerominia.getTime() / 1000).toFixed(0);
            } catch (e) {
                try {
                    x = +((new Date(imerominia.replace(' ', 'T'))).getTime() / 1000).toFixed(0);
                } catch (e) {
                    x = new Date();
                }
            }
            console.log(x)
            return x;
        }
        return {
            get_user_level: get_user_level,
            get_receipt: get_receipt,
            save_receipt: save_receipt,
            update_receipt: update_receipt,
            delete_receipt: delete_receipt,
            get_receipts_count: get_receipts_count,
            get_receipts_sum: get_receipts_sum,
            get_receipts: get_receipts,
            insert_category: insert_category,
            get_all_categories: get_all_categories,
            get_categories_count:get_categories_count,
            edit_category: edit_category,
            assign_receipt_to_category: assign_receipt_to_category,
            assign_receipt_to_category_extended: assign_receipt_to_category_extended,
            delete_receipt_from_category: delete_receipt_from_category,
            get_categories_from_receipt: get_categories_from_receipt,
            get_receipts_from_category: get_receipts_from_category,
            get_receipts_from_category_extended: get_receipts_from_category_extended,
            search_category: search_category,
            insert_categories_and_assign: insert_categories_and_assign,
            delete_receipt_from_category_name: delete_receipt_from_category_name,
            get_raw_db: function() {
                return db;
            },
            set_synchronization: set_synchronization,
            get_synchronization: get_synchronization
        }

    })
    .service('imageToBLOB', function($ionicPlatform, $q) {
        return function(file_path) {

            var deferred = $q.defer();
            if (!file_path) {
                deferred.reject('no file path');
                return deferred.promise;
            }
            $ionicPlatform.ready(function() {

                if (ionic.Platform.isAndroid()) {
                    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFS, fail);
                } else if (ionic.Platform.isIOS()) {
                    window.resolveLocalFileSystemURI(file_path, gotFileEntry, fail);

                }

                function gotFS(fileSystem) {
                    fileSystem.root.getFile(file_path, null, gotFileEntry, fail);
                }

                function gotFileEntry(fileEntry) {
                    fileEntry.file(gotFile, fail);
                }

                function gotFile(file) {
                    readDataUrl(file);
                }

                function readDataUrl(file) {
                    var reader = new FileReader();
                    reader.onloadend = function(evt) {
                        deferred.resolve(evt.target.result);
                    };
                    reader.readAsDataURL(file);
                }

                function fail(error) {
                    deferred.reject('File error');
                }
            })
            return deferred.promise;

        }

    })
    .service('syncHelper', function(DB, $q) {
        function db_result_to_array(results) {
            var toReturn = [];
            var len = results.rows.length;
            for (var i = 0; i < len; i++) {
                var x = results.rows.item(i);
                x.image = x.image ? x.image : undefined
                toReturn.push(x);
            }
            return toReturn;
        }

        function get_sync_time() {
            var deferred = $q.defer();
            var db = DB.get_raw_db();
            DB.get_synchronization()
                .then(function(data) {
                    if (data && data.synced_time) {
                        deferred.resolve(data.synced_time)
                    } else {
                        //no synced time go for all
                        deferred.resolve(0)
                    }
                }).catch(deferred.reject)
            return deferred.promise;
        }

        function init() {
            get_sync_time()
                .then(function(synced_time) {
                    get_deleted_receipts(synced_time);
                    get_newOrUpdated_receipts(synced_time);
                    get_deleted_categoriesPivot(synced_time);
                    get_newOrUpdated_categoriesPivot(synced_time);
                    get_new_categories(synced_time);

                })
                .catch(function() {
                    alert('')
                })
        }

        function truncate_receipts() {
            var deferred = $q.defer();
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("DELETE FROM receipts;", [], deferred.resolve, deferred.reject);
            });
            return deferred.promise;
        }

        function truncate_categories() {
            var deferred = $q.defer();
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("DELETE FROM categories;", [], deferred.resolve, deferred.reject);
            });
            return deferred.promise;
        }

        function truncate_category_receipts() {
            var deferred = $q.defer();
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("DELETE FROM category_receipts;", [], deferred.resolve, deferred.reject);
            });
            return deferred.promise;
        }

        function get_deleted_receipts() {
            var deferred = $q.defer();
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("SELECT sid AS receipt_sid FROM receipts WHERE deleted = 1 AND sid IS NOT NULL", [],
                    function(tx, results) {
                        console.log("DELETED::")
                        deferred.resolve(db_result_to_array(results));
                    }, function(e) {
                        prettyLog(e)
                    });
            });

            return deferred.promise;
        }

        function get_newOrUpdated_receipts() {

            var deferred = $q.defer();
            get_sync_time()
                .then(function(synced_time) {
                    var db = DB.get_raw_db();
                    db.transaction(function(tx) {
                        tx.executeSql("SELECT * FROM receipts " +
                            "WHERE deleted = 0 AND datetime(updated_at,'localtime') > datetime(?,'localtime')", [synced_time],
                            function(tx, results) {
                                console.log("NEW OR UPDATED::");
                                deferred.resolve(db_result_to_array(results));
                            }, deferred.reject);
                    });
                });
            return deferred.promise;


        }

        function get_deleted_categoriesPivot(synced_time) {
            var deferred = $q.defer();
            get_sync_time()
                .then(function(synced_time) {
                    var db = DB.get_raw_db();
                    db.transaction(function(tx) {
                        tx.executeSql("SELECT receipts.sid AS receipt_sid,categories.sid AS category_sid FROM category_receipts " +
                            "LEFT JOIN receipts on category_receipts.receipt_id=receipts.id " +
                            "LEFT JOIN categories on category_receipts.category_id=categories.id " +
                            "WHERE category_receipts.deleted = 1 AND receipts.sid IS NOT NULL AND categories.sid IS NOT NULL", [],
                            function(tx, results) {
                                console.log("DELETED PIVOT::")
                                deferred.resolve(db_result_to_array(results));
                            }, function(e) {
                                prettyLog(e)
                            });
                    });
                });
            return deferred.promise;
        }

        function get_newOrUpdated_categoriesPivot(synced_time) {
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM category_receipts " +
                    "WHERE deleted = 0 AND datetime(updated_at,'localtime') > datetime(?,'localtime')", [synced_time],
                    function(tx, results) {
                        console.log("NEW OR UPDATED PIVOT::")
                        prettyLog(db_result_to_array(results));
                    }, function(e) {
                        prettyLog(e)
                    });
            });
        }

        function get_newOrUpdated_categoriesPivot_by_receipt(receipt_id) {
            var deferred = $q.defer();
            get_sync_time()
                .then(function(synced_time) {
                    var db = DB.get_raw_db();
                    db.transaction(function(tx) {
                        tx.executeSql("SELECT * FROM category_receipts " +
                            "LEFT JOIN categories on category_receipts.category_id=categories.id " +
                            "WHERE category_receipts.deleted = 0 AND datetime(category_receipts.updated_at,'localtime') > datetime(?,'localtime') AND category_receipts.receipt_id = ?", [synced_time, receipt_id],
                            function(tx, results) {
                                deferred.resolve(db_result_to_array(results));
                            }, function(e) {
                                deferred.reject(e)
                            });
                    });
                });
            return deferred.promise;
        }

        function get_new_categories(synced_time) {
            var db = DB.get_raw_db();
            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM categories " +
                    "WHERE datetime(updated_at,'localtime') > datetime(?,'localtime')", [synced_time],
                    function(tx, results) {
                        console.log("NEW CATEGORIES::")
                        prettyLog(db_result_to_array(results));
                    }, function(e) {
                        prettyLog(e)
                    });
            });
        }
        return {
            get_newOrUpdated_receipts: get_newOrUpdated_receipts,
            truncate_receipts: truncate_receipts,
            truncate_categories: truncate_categories,
            truncate_category_receipts: truncate_category_receipts,
            get_deleted_receipts: get_deleted_receipts,
            get_newOrUpdated_categoriesPivot_by_receipt: get_newOrUpdated_categoriesPivot_by_receipt,
            get_deleted_categoriesPivot: get_deleted_categoriesPivot
        }


    })
    .service('Promotions', function(localStorageService) {

        function check_promotions(new_proms) {
            promotions = localStorageService.get('promotions') || [];
            new_proms = new_proms || [];
            var toReturn = {
                new_proms : []
            }

            new_proms.forEach(function(new_prom){
                var res = promotions.filter(function(x){
                    return x.id == new_prom.id;
                });
                if(res.length == 0){ 
                    promotions.push(new_prom);
                    toReturn.new_proms.push(new_prom);

                }
            })
            
            localStorageService.set('promotions', promotions);
            toReturn.all_proms = promotions;
            return toReturn;
        }

        
        return {
            check_promotions: check_promotions
        };
    })
    .service('User', function(localStorageService) {

        function set_credentials(email, password, token) {
            user = localStorageService.get('user') || {};
            if (email && password && token) {
                user.email = email;
                user.password = password;
                user.token = token;
                user.logged = true;
            }
            localStorageService.set('user', user);
        }

        function get_credentials() {
            user = localStorageService.get('user');
            if (user && user.email && user.password) {
                return {
                    email: user.email,
                    password: user.password,
                    logged: user.logged
                }
            }
            return {};
        }

        function get_token() {
            user = localStorageService.get('user');
            if (user && user.token) {
                return user.token
            }
            return null;
        }

        function logout() {
            localStorageService.remove('user');
        }
        return {
            set_credentials: set_credentials,
            get_credentials: get_credentials,
            logout: logout,
            get_token: get_token
        };
    })
    .service('APIInterceptor', function($q, $location, User) {
        return {
            'request': function(config) {
                config.headers = config.headers || {};
                var token = User.get_token();
                if (token) {
                    console.log('i give', token)
                    config.headers.Authorization = 'Bearer ' + token;
                }
                return config;
            }
        };

    })
    .service('api', function(API_URL,$http, User, DB, syncHelper,Promotions, $q) {

        function test_prom() {
            var deferred = $q.defer();
            setTimeout(deferred.resolve, 1000);
            return deferred.promise;

        }

        function send_receipts(receipts) {
            var create_receipts_proms = [],
                query_categories_proms = [],
                create_categories_proms = [],
                assign_receipt_category_proms = [];
            console.log('lllll', receipts.length)
            receipts.forEach(function(receipt) {
                console.log(receipt.image)
                var req = receipt.sid ?
                    $http.put(API_URL+'api/me/receipts/' + receipt.sid, receipt) :
                    $http.post(API_URL+'api/me/receipts', receipt);
                create_receipts_proms.push(req.then(function(resp) {
                    var data = resp.data;
                    data.sid = data.id;
                    data.id = receipt.id;
                    query_categories_proms.push(sent_categories(data, create_categories_proms, assign_receipt_category_proms));
                }));
            })
            $q.all(create_receipts_proms).finally(function() {
                console.log('all http ended')
                $q.all(query_categories_proms).finally(function() {
                    console.log('all query ended');
                    $q.all(create_categories_proms).finally(function() {
                        console.log('all create_categories_proms ended');
                        $q.all(assign_receipt_category_proms).finally(function() {
                            console.log('all assign_receipt_category_proms ended');
                            //finally all things are done!!
                            delete_and_get_receipts();
                        })
                    })
                })
            })
            return;
        }

        function sent_categories(receipt, create_categories_proms, assign_receipt_category_proms) {
            return syncHelper.get_newOrUpdated_categoriesPivot_by_receipt(receipt.id)
                .then(function(categories) {
                    categories.forEach(function(category) {
                        var req = category.sid ?
                            $http.put(API_URL+'api/me/categories/' + category.sid, category) :
                            $http.post(API_URL+'api/me/categories', category);
                        create_categories_proms.push(req.then(function(resp) {
                            var data = resp.data;
                            data.sid = data.id;
                            data.id = category.id;
                            assign_receipt_category_proms.push(sent_receipt_category_pivot(receipt.sid, data.sid));
                        }))

                    })
                })
        }

        function sent_receipt_category_pivot(receipt_sid, category_sid) {
            return $http.post(API_URL+'api/me/receipts/' + receipt_sid + '/categories/' + category_sid)
        }



        //phase 2 sync
        function delete_and_get_receipts() {
            syncHelper.truncate_receipts().then(function() {
                $http.get(API_URL+'api/me/receipts').then(function(data) {
                    var receipts = data.data;
                    var save_receipt_proms = [];
                    receipts.forEach(function(receipt) {
                        var temp = receipt;
                        temp.sid = temp.id;
                        temp.id = null;
                        save_receipt_proms.push(DB.save_receipt(temp))
                    });
                    $q.all(save_receipt_proms).finally(delete_and_get_categories)
                })
            })
        }

        function delete_and_get_categories() {
            syncHelper.truncate_categories().then(function() {
                $http.get(API_URL+'api/me/categories').then(function(data) {
                    var categories = data.data;
                    var save_category_proms = [];
                    categories.forEach(function(category) {
                        save_category_proms.push(DB.insert_category(category.name, category.id))
                    });
                    $q.all(save_category_proms).finally(delete_and_get_category_receipts)
                })
            })
        }

        function delete_and_get_category_receipts() {
            syncHelper.truncate_category_receipts().then(function() {
                $http.get(API_URL+'api/me/receiptscategories').then(function(data) {
                    prettyLog(data)
                    var pivot = data.data;
                    var save_pivot_proms = [];
                    pivot.forEach(function(entry) {
                        prettyLog(entry.receipt_id, entry.category_id)
                        save_pivot_proms.push(DB.assign_receipt_to_category_extended(entry.receipt_id, entry.category_id))
                    });
                    $q.all(save_pivot_proms).finally(function() {
                        DB.set_synchronization().then(function() {
                            alert('ok!')
                        })
                    })
                })
            })
        }

        function remove_receipts(receipts) {
            console.log('res::')
            prettyLog(receipts)

            var promises = receipts.map(function(r) {
                return $http.delete(API_URL+'api/me/receipts/' + r.receipt_sid)
            });
            return $q.all(promises);
        }

        function remove_categories_pivot(categories_pivot) {
            console.log('piv::')
            prettyLog(categories_pivot)
            var promises = categories_pivot.map(function(p) {
                return $http.delete(API_URL+'api/me/receipts/' + p.receipt_sid + '/categories/' + p.category_sid)
            });
            return $q.all(promises);
        }
        return {

            login: function(email, password) {
                //User.set_credentials(email, password, 'huge token')
                return $http.post(API_URL+'jwt/create', {
                        email: email,
                        password: password
                    })
                    .success(function(resp) {
                        alert('logged')
                        prettyLog(resp)
                        User.set_credentials(email, password, resp.token);
                        $http.get(API_URL+'api/me/receipts')
                    })
                    .error(function(err) {
                        prettyLog(err);
                        alert('error')
                    });
            },
            register: function(email, password) {
                User.set_credentials(email, password, 'huge token')

                // return $http.post(API_URL+'jwt/create', {
                //         email: 'kipouros@me.com',
                //         password: 'kipouros'
                //     })
                //     .finally(function(resp) {
                //         User.set_credentials(email, password)
                //         //User.token = resp.data.token;
                //     })
                //     .catch(function(err) {
                //         console.error(err);
                //     })
            },
            synchronize: function() {

                syncHelper.get_deleted_receipts().then(function(res) {
                    remove_receipts(res).finally(function() {
                        console.log('receipts deleted');
                        syncHelper.get_deleted_categoriesPivot().then(function(piv) {
                            remove_categories_pivot(piv).finally(function() {
                                console.log('pivots deleted');
                                syncHelper.get_newOrUpdated_receipts().then(send_receipts)
                            })
                        })
                    })



                })
            },
            getPromotions : function(){
                var deferred = $q.defer();
                $http.get(API_URL+'api/promotions')
                .success(function(data){
                    prettyLog(Promotions.check_promotions)
                    deferred.resolve(Promotions.check_promotions(data));
                })
                return deferred.promise;
            }
        }
    })
.service('DatesStorage',function(localStorageService){
     
    return {
        setEditDates: function(){
            var editDates = localStorageService.get('editDates');
            editDates = editDates || [];
            editDates.push(new Date());
            localStorageService.set('editDates',editDates);
            return editDates;
        },
        getEditDates: function(){
            var editDates = localStorageService.get('editDates');
            editDates = editDates || [];
            return editDates;
        },
        setSubmitDates: function(){
            var submitDates = localStorageService.get('submitDates');
            submitDates = submitDates || [];
            submitDates.push(new Date());
            localStorageService.set('submitDates',submitDates);
            return submitDates;
        },      
        getSubmitDates: function(){
            var submitDates = localStorageService.get('submitDates');
            submitDates = submitDates || [];
            return submitDates;
        }
    }
})
    .service('Achievements', function(localStorageService,DatesStorage, DB, $q) {

        const ONE_DAY = 1000*60*60*24;
        function daysAgo(days){
            return (new Date(new Date() - ONE_DAY * days));
        }
        function get_or_create_achievements() {
            var achievements_list = localStorageService.get('achievements');
            if (!achievements_list) {
                achievements_list = [{
                    receipts_count: 1,
                    text: 'Μολις καταχωρησες την πρωτη σου αποδειξη'
                }, {
                    receipts_count: 5,
                    text: 'Μολις καταχωρησες 5 αποδειξεις'
                }, {
                    receipts_sum: 50,
                    text: 'Καταχωρησες 50 ευρω σε αποδειξεις'
                },{
                    submit_date_sum: 15,
                    submit_date: daysAgo(7),
                    text: '15 αποδειξεις'
                },{
                    edit_date_sum: 2,
                    edit_date: daysAgo(7),
                    text: '2 επεξεργασιες σε 7 μερες'
                },
                {
                    categories_count: 3,
                    text: 'Εβαλες 3 κατηγοριες! Εισαι νοικοκυρης!'
                }];
                achievements_list = achievements_list.map(function(r) {
                    r.done = false;
                    r.receipts_count = r.receipts_count || -1;
                    r.receipts_sum = r.receipts_sum || -1;
                    r.submit_date = r.submit_date || new Date(0);
                    r.submit_date_sum = r.submit_date_sum || -1;
                    r.edit_date = r.edit_date || new Date(0);
                    r.edit_date_sum = r.edit_date_sum || -1;
                    r.categories_count = r.categories_count || -1;
                    return r;
                });
                localStorageService.set('achievements', achievements_list);
            }
            return achievements_list;
        }

        function check_edit_dates(target_date){
            target_date = target_date instanceof Date ? target_date : new Date(target_date);
            return (DatesStorage.getEditDates().filter(function(x){
                x = x instanceof Date ? x : new Date(x);
                return x > target_date;
            })).length;
        }
        function check_submit_dates(target_date){
            target_date = target_date instanceof Date ? target_date : new Date(target_date);
            return (DatesStorage.getSubmitDates().filter(function(x){
                x = x instanceof Date ? x : new Date(x);
                return x > target_date;
            })).length;
        }
        


        function save_achievements(achievements_list) {
            localStorageService.set('achievements', achievements_list);
        }

        function check_completed_achievements() {
            var achievements_list = get_or_create_achievements(),
                results = [],
                deferred = $q.defer();
            $q.all([DB.get_receipts_count(), DB.get_receipts_sum(), DB.get_categories_count()])
                .then(function(data) {
                    var count = data[0] || 0;
                    var sum = data[1] || 0;
                    var categories_count = data[2] || 0;
                    console.log(categories_count)
                    
                    achievements_list.forEach(check);
                    save_achievements(achievements_list);
                    deferred.resolve(results);

                    function check(ach) {
                        prettyLog(ach)
                        if (!ach.done && count >= ach.receipts_count && 
                            sum >= ach.receipts_sum && check_submit_dates(ach.submit_date) >= ach.submit_date_sum &&
                            check_edit_dates(ach.edit_date) >= ach.edit_date_sum && categories_count >= ach.categories_count) {
                            ach.done = true;
                            results.push(ach.text);
                        }
                    }
                })

            return deferred.promise;
        }
        return {
            getAll: get_or_create_achievements,
            check_completed_achievements: check_completed_achievements
        }
    })