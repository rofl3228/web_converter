var AlgebraAnswer = require('../lib/RelationalAlgebraAnswer');
var TupleAnswer = require('../lib/TupleCalculusAnswer');
var count_pages = ApplicationHelper.count_pages;
var TestCases = require('../lib/TestCases');
var moment = require('moment');

var get = {
    '/': function (req, res) {
        res.render('questions/index');
    },

    '/table': function (req, res) {
        var options = {};
        if (req.query.user_id) {
            options.user_id = req.query.user_id;
        }
        if (req.query.check_point_id) {
            options.check_point_id = req.query.check_point_id;
        }
        if (req.query.question_id) {
            options.question_id = req.query.question_id;
        }
        var skip = 0,
            limit = 15,
            page = Number(req.query.page) || 1;

        if (page > 1)
            skip = limit * (page - 1);

        app.QuestionAnswer.findAndCountAll({
                where: options,
                include: [{
                    model: app.Question,
                    include: [{
                        model: app.DataBase,
                        attributes: ['id', 'title']
                    }]
                }],
                limit: limit,
                offset: skip,
                order: 'id DESC'

            }).then(function(answers) {
                var pages =  count_pages(answers.count, limit),
                    pages_min = (page - 3 < 1) ? 1 : page - 3,
                    pages_max = (pages_min + 6 > pages) ? pages : pages_min + 6;

                res.render('questions_answers/table', {
                    answers: answers.rows,
                    page: page,
                    pages: pages,
                    pages_min: pages_min,
                    pages_max: pages_max
                });
            }).catch(function(err) {
                console.log('err', err);
                res.error('Error', err);
            });
    },



    '/:id': function (req, res) {
	console.log('[' + new Date() + '] ', 'question answer\nuser\n', req.user.id + ' : ' + req.user.name, '\nquery\n', req.query, '\nbody\n', req.body, '\nparams\n', req.params);
        var options = {};
        options.id = Number(req.params.id);

        var ctx = {};

        app.QuestionAnswer.findOne({
                where: options,
                include: [{
                    model: app.Question,
                    include: [{
                        model: app.DataBase,
                        attributes: ['id', 'title', 'type']
                    }]
                }],
            }).then(function (answer) {

                if (!answer) {
                    throw {message: 'NotFound'};
                } else {
                    ctx.answer = answer;
                    return app.DataBase.execute_sql(answer.question.db_id, answer.question.sql_answer);
                }
            }).then(function(sql_res) {

                ctx.answer.right_answer_data = sql_res.result.rows;
                ctx.answer.data = [];

                if (ctx.answer.sql.indexOf('SELECT') >= 0) {
                    return app.DataBase.execute_sql(ctx.answer.question.db_id, ctx.answer.sql)
                        .then(function(student_sql_res) {
                            if (student_sql_res) {
                                ctx.answer.data = student_sql_res.result.rows;
                            }
                        }).catch(function(err) {
                            ctx.answer.sql_err = err;
                        });
                }
            }).then(function(student_sql_res) {
                res.render('questions_answers/show', { answer: ctx.answer, user: req.user });
            }).catch(function (err) {
                console.log('err question answer get /:id', err);
                res.error(err);
            });
    }

};

var post = {
    '/make': function (req, res) {
	    console.log('[' + new Date() + '] ', 'question answer make\nuser\n', req.user.id + ' : ' + req.user.name,
            '\nquery\n', req.query, '\nbody\n', req.body, '\nparams\n', req.params);
        var check_point_id = req.body.check_point_id;
        var queries = JSON.parse(req.body.queries);
        var question_id = req.body.question_id;
        var db_id = req.body.db_id;
        var ctx = {};

        //сохранить ответ на вопрос
        app.QuestionAnswer.make(req.user.id, question_id, db_id, queries, check_point_id)
            .then(function(result) {
                console.log('[' + new Date() + '] user ', req.user.id + ' : ' + req.user.name, ' Вызвана QuestionAnswer.make:\n', result.id, result.answer);

                //нужно обновить общую оценку
                if (result) {
                    ctx = {
                        mark: result.mark,
                        comment: result.comment
                    };

                    return app.TestAnswer.update(
                        {total_mark: sequelize.literal('total_mark +' + result.mark)},
                        {where: {
                            check_point_id: check_point_id,
                            user_id: req.user.id
                        }}
                    ).then((result) => {
                        return result;
                    }).catch((err) => {
                        console.log('upd mark failed');
                        throw err;
                    });
                }
            }).then(function(result) {
                console.log('[' + new Date() + '] ', 'result of Test Answer upd.\n', result,'\n%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%');
                res.success(ctx);
            }).catch(function(err) {
                console.log('[' + new Date() + ']' + 'Question answer make error\n', err);
                res.error(err);
            });
    },

    '/recheck/:id': function (req, res) {
        var id = Number(req.params.id);
        var ctx = {};

        app.QuestionAnswer.findOne({
            where: {id: id},
            include: [{
                model: app.Question
            }],
        }).then(function (answer) {
            if (!answer) {
                throw {message: 'NotFound'};
            } else {
                return new Promise(function (resolve, reject) {

                    req.body = {
                        check_point_id : answer.check_point_id,
                        queries : JSON.stringify(answer.answer),
                        question_id : answer.question_id,
                        db_id : answer.question.db_id,
                    };
                    req.user.id = answer.user_id;

                    post['/make'](req, {
                        success: function (result) {
                            resolve(result);
                        },
                        error: function (error) {
                            reject(error);
                        }
                    });
                });
            }
        }).then(function (result) {
            res.success(result);
        }).catch(function(err) {
            console.log('recheck error', err);
            res.error(err);
        });
    },


    '/add': function (req, res) {
	    console.log('\n\nquestion answer add\nuser\n', req.user.id + ' : ' + req.user.name, '\nquery\n', req.query, '\nbody\n', req.body, '\nparams\n', req.params);
        var queries = JSON.parse(req.body.queries);
        var question_id = req.body.question_id;
        var db_id = req.body.db_id;
        var ctx = {};

        app.Question.findById(question_id).then(function (question) {
            ctx.question = question;
            if(question.query_type == "RA"){
                    ctx.query_answer = new AlgebraAnswer(JSON.parse(req.body.queries));
            }
            else {
                    ctx.query_answer = new TupleAnswer(JSON.parse(req.body.queries));
            }

            return ctx.query_answer.create_sql_script();
        }).then(function(result) {
                ctx.answer_sql = result;

                return app.DataBase.execute_sql(db_id, result);
            }).then(function(sql_res) {
                ctx.query_answer.answer_data = sql_res.result.rows;
                ctx.answer_data = sql_res.result.rows;

                //TODO проверка прав возвращать ли правильный ответ
                ctx.right_answer_sql = ctx.question.sql_answer;

                return app.DataBase.execute_sql(db_id, ctx.question.sql_answer);
            }).then(function(sql_res) {
                ctx.query_answer.right_answer_data = sql_res.result.rows;
                ctx.right_answer_data = sql_res.result.rows;
                //сверка результатов выполнения двух запросов
                var mark = ctx.query_answer.check();
                ctx = Object.assign({}, mark, ctx)

                if (req.user.role.role == 'student') {
                    return app.QuestionAnswer.create({
                        answer: queries,
                        processed_answer: ctx.query_answer.queries,
                        user_id: req.user.id,
                        question_id: question_id,
                        mark: mark.mark,
                        error: mark.comment,
                        sql: ctx.answer_sql
                    });
                } else {
                    return new Promise(function(resolve, reject) {
                        resolve();
                    });
                }
            }).then(function(result) {
                res.success(ctx);
            }).catch(function(err) {
                return app.QuestionAnswer.create({
                    answer: queries,
                    processed_answer: ctx.query_answer.queries,
                    user_id: req.user.id,
                    question_id: question_id,
                    mark: 0,
                    error: err.message || err,
                    sql: (ctx.answer_sql ? ctx.answer_sql : "Не удалось выполнить генерацию SQL.")
                }).then(function(result) {
                    res.error(err);
                }).catch(function(err_saving_log) {
                    console.log('err_saving_log', err_saving_log)
                    res.error(err);
                });
            });

    },

};


var _delete = {
   '/remove/:id':  function (req, res) {
        var id = Number(req.params.id);

        app.Question.remove(id)
            .then(function() {
                res.success({});
            }).catch(function(err) {
                res.error('Error', err);
            });
    }
};

var put = {
   '/:id':  function (req, res) {
       console.log('in question put controller', req.body);
        var id = Number(req.params.id);
        var data = {};

        if (req.body.name && req.body.value)
            data[req.body.name] = req.body.value;
        else
            data = req.body;

        // нельзя для вопроса менять поля
        delete data.query_type;
        delete data.db_id;
        delete data.db_title;
        delete data.deleted;

        if (data.sql_answer) {
            data.sql_answer = data.sql_answer.replace(/\"/g, "'");
        }

        app.Question.update(
                data,
                {where: {id: id}}
            ).then(function() {
                res.success({});
            }).catch(function(err) {
                res.error('Error', err);
            });
    }
};

module.exports = {
    resource: 'QuestionAnswer',
    methods: {
        get: get,
        post: post,
        put: put,
        delete: _delete
    }
}
