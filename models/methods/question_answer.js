'use strict'
var AlgebraAnswer = require('../../lib/RelationalAlgebraAnswer');
var TupleAnswer = require('../../lib/TupleCalculusAnswer');

module.exports = function (models) {
    var DataBase = models.DataBase;
    var Question = models.Question;
    var QuestionAnswer = models.QuestionAnswer;

    QuestionAnswer.make = function (user_id, question_id, db_id, queries, check_point_id) {
        app.Question.findOne({//find question by id
            where : {
                id : question_id
            }
        }).then((result) => {//take only question data
            return result.dataValues;
        }).then(question => {//make answer by queries
            var ctx = {};
            if (question.query_type == "RA") {
                ctx.query_answer = new AlgebraAnswer(queries);
            }
            else {
                ctx.query_answer = new TupleAnswer(queries);
            }
            return ctx;
        }).then(ctx => {//generate SQL request to DB
            return ctx.query_answer.create_sql_script()
                .then(function(result) {
                    ctx.answer_sql = result;
                    return app.DataBase.execute_sql(db_id, result);
                }).then(function(sql_res) {
                    ctx.query_answer.answer_data = sql_res.result.rows;
                    ctx.answer_data = sql_res.result.rows;

                    return app.Question.findById(question_id);
                }).then(function(question) {
                    //TODO проверка прав возвращать ли правильный ответ
                    ctx.right_answer_sql = question.sql_answer;
                    return app.DataBase.execute_sql(db_id, question.sql_answer);
                }).then(function(sql_res) {
                    ctx.query_answer.right_answer_data = sql_res.result.rows;
                    ctx.right_answer_data = sql_res.result.rows;
                    //сверка результатов выполнения двух запросов
                    var mark = ctx.query_answer.check();
                    ctx = Object.assign({}, mark, ctx);

                    return app.QuestionAnswer.create({
                        answer: queries,
                        processed_answer: ctx.query_answer.queries,
                        user_id: user_id,
                        question_id: question_id,
                        check_point_id: check_point_id,
                        mark: mark.mark,
                        error: mark.comment,
                        sql: ctx.answer_sql
                    });
                }).then(function(result) {
                    return result;
                }).catch(function(err) {
                    console.log('\n\n\npost /trial err', err);

                    console.log('\n\n\ncreating question answer if err!!!!!!!!!!!!!!!!!!!!!!!!!!!');
                    app.QuestionAnswer.create({
                        answer: queries,
                        processed_answer: ctx.query_answer.queries,
                        user_id: user_id,
                        question_id: question_id,
                        check_point_id: check_point_id,
                        mark: 0,
                        error: err.message,
                        sql: (ctx.answer_sql ? ctx.answer_sql : "Не удалось выполнить генерацию SQL.")
                    }).then(function(result) {
                        console.log('result', result);
                        throw err;
                    }).catch(function(err_saving_log) {
                        console.log('\n\n\nerror creating question answer if err!!!!!!!!!!!!!!!!!!!!!!!!!!!', err_saving_log);
                        throw err;
                    });
                }).catch(function(err) {

                    console.log('\n\n\nerrr while saving incorrect answer');

                    throw err;
                });
        });

    }


};