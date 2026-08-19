const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

// ======================================================
// PATHS
// ======================================================

const PUBLIC_FOLDER = path.join(__dirname, 'public');
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');


// ======================================================
// CREATE UPLOAD FOLDER
// ======================================================

if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER, {
        recursive: true
    });
}


// ======================================================
// MYSQL CONNECTION POOL
// ======================================================

const db = mysql.createPool({

    host: process.env.DB_HOST || 'localhost',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || '',

    database: process.env.DB_NAME || 'lokbharti_epaper',

    port: Number(process.env.DB_PORT) || 3306,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    charset: 'utf8mb4'

});


// ======================================================
// TEST MYSQL CONNECTION
// ======================================================

async function testDatabaseConnection() {

    try {

        const connection =
            await db.getConnection();

        console.log(
            'MySQL Database Connected Successfully.'
        );

        console.log(
            `Database: ${process.env.DB_NAME || 'lokbharti_epaper'}`
        );

        connection.release();

    } catch (error) {

        console.error(
            'MySQL Connection Error:',
            error.message
        );

        process.exit(1);

    }

}


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================================
// SESSION
// ======================================================
app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            'lokbharti-epaper-secret-2026',

        resave: false,

        saveUninitialized: false,

        cookie: {

            httpOnly: true,

            secure:
                process.env.NODE_ENV === 'production',

            sameSite: 'lax',

            maxAge:
                60 * 60 * 1000

        }

    })
);

// ======================================================
// ADMIN AUTHENTICATION
// ======================================================

function checkAdmin(req, res, next) {

    if (
        req.session &&
        req.session.isAdmin === true
    ) {

        return next();

    }

    return res.redirect(
        '/admin-login.html'
    );

}


// ======================================================
// PROTECTED ADMIN PAGE
// ======================================================

app.get(
    '/admin.html',
    checkAdmin,
    (req, res) => {

        return res.sendFile(
            path.join(
                PUBLIC_FOLDER,
                'admin.html'
            )
        );

    }
);


// ======================================================
// ADMIN PANEL ROUTE
// ======================================================

app.get(
    '/admin-panel',
    checkAdmin,
    (req, res) => {

        return res.sendFile(
            path.join(
                PUBLIC_FOLDER,
                'admin.html'
            )
        );

    }
);


// ======================================================
// PUBLIC STATIC FILES
// ======================================================

app.use(
    express.static(
        PUBLIC_FOLDER
    )
);


// ======================================================
// PDF FILES
// ======================================================

app.use(
    '/uploads',
    express.static(
        UPLOAD_FOLDER
    )
);


// ======================================================
// MULTER STORAGE
// ======================================================

const storage =
    multer.diskStorage({

        destination:
            (req, file, cb) => {

                cb(
                    null,
                    UPLOAD_FOLDER
                );

            },

        filename:
            (req, file, cb) => {

                const uniqueName =
                    Date.now() +
                    '-' +
                    Math.round(
                        Math.random() * 1E9
                    ) +
                    path.extname(
                        file.originalname
                    );

                cb(
                    null,
                    uniqueName
                );

            }

    });


// ======================================================
// MULTER UPLOAD
// ======================================================
const upload = multer({

    storage: storage,

    limits: {
        fileSize: 50 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const extension =
            path.extname(
                file.originalname
            ).toLowerCase();

        if (extension !== '.pdf') {

            return cb(
                new Error(
                    'फक्त PDF फाईल अपलोड करा.'
                )
            );

        }

        cb(null, true);

    }

});

// ======================================================
// GET PAPER INFORMATION
// ======================================================
//
// Frontend ला जुन्या JSON structure सारखाच response
// मिळेल:
//
// {
//     daily: [],
//     weekly: [],
//     monthly: []
// }
//
// त्यामुळे existing UI बदलण्याची गरज नाही.
// ======================================================

app.get(
    '/get-paper-info',
    async (req, res) => {

        try {

            const [
                dailyRows
            ] = await db.execute(
                `
                SELECT
                    id,
                    category,
                    pdf_path,
                    editor,
                    mobile,
                    year,
                    issue,
                    date_mr,
                    date_en,
                    rni,
                    price,
                    pages,
                    upload_time,
                    created_at
                FROM epapers
                WHERE category = 'daily'
                ORDER BY upload_time DESC, id DESC
                `
            );


            const [
                weeklyRows
            ] = await db.execute(
                `
                SELECT
                    id,
                    category,
                    pdf_path,
                    editor,
                    mobile,
                    year,
                    issue,
                    date_mr,
                    date_en,
                    rni,
                    price,
                    pages,
                    upload_time,
                    created_at
                FROM epapers
                WHERE category = 'weekly'
                ORDER BY upload_time DESC, id DESC
                `
            );


            const [
                monthlyRows
            ] = await db.execute(
                `
                SELECT
                    id,
                    category,
                    pdf_path,
                    editor,
                    mobile,
                    year,
                    issue,
                    date_mr,
                    date_en,
                    rni,
                    price,
                    pages,
                    upload_time,
                    created_at
                FROM epapers
                WHERE category = 'monthly'
                ORDER BY upload_time DESC, id DESC
                `
            );


            // ==================================================
            // Convert DB field names to existing frontend names
            // ==================================================

            function formatPaper(row) {

                return {

                    id:
                        row.id,

                    category:
                        row.category,

                    pdfPath:
                        row.pdf_path,

                    editor:
                        row.editor || '',

                    mobile:
                        row.mobile || '',

                    year:
                        row.year || '',

                    issue:
                        row.issue || '',

                    date_mr:
                        row.date_mr || '',

                    date_en:
                        row.date_en || '',

                    rni:
                        row.rni || '',

                    price:
                        row.price || '',

                    pages:
                        row.pages || '',

                    uploadTime:
                        Number(
                            row.upload_time
                        ),

                    created_at:
                        row.created_at

                };

            }


            return res.json({

                daily:
                    dailyRows.map(
                        formatPaper
                    ),

                weekly:
                    weeklyRows.map(
                        formatPaper
                    ),

                monthly:
                    monthlyRows.map(
                        formatPaper
                    )

            });

        } catch (error) {

            console.error(
                'GET PAPER INFO ERROR:',
                error
            );

            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        'पेपर डेटा वाचताना एरर आली.'

                });

        }

    }
);


// ======================================================
// ADMIN LOGIN
// ======================================================
app.post(
    '/admin-login',
    async (req, res) => {

        const username =
            req.body.username;

        const password =
            req.body.password;


        if (
            !username ||
            !password
        ) {

            return res.json({

                success: false,

                message:
                    'Username आणि Password भरा.'

            });

        }


        try {

            const [
                rows
            ] = await db.execute(

                `
                SELECT
                    id,
                    username,
                    password
                FROM admin_users
                WHERE username = ?
                LIMIT 1
                `,

                [
                    username
                ]

            );


            if (
                rows.length === 0
            ) {

                return res.json({

                    success: false,

                    message:
                        'Username किंवा Password चुकीचा आहे.'

                });

            }


            const admin =
                rows[0];


            // ==================================================
            // BCRYPT PASSWORD CHECK
            // ==================================================

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    admin.password
                );


            if (!passwordMatch) {

                return res.json({

                    success: false,

                    message:
                        'Username किंवा Password चुकीचा आहे.'

                });

            }


            // ==================================================
            // ADMIN SESSION
            // ==================================================

            req.session.isAdmin =
                true;

            req.session.username =
                admin.username;

            req.session.adminId =
                admin.id;


            return res.json({

                success: true,

                message:
                    'Login यशस्वी!'

            });

        } catch (error) {

            console.error(
                'ADMIN LOGIN ERROR:',
                error
            );

            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        'डेटाबेसमध्ये समस्या आली.'

                });

        }

    }
);

// ======================================================
// UPLOAD NEW E-PAPER
// ======================================================

app.post(
    '/upload-paper',

    checkAdmin,

    upload.single(
        'epaper_pdf'
    ),

    async (req, res) => {

        const category =
            req.body.category;


        // ==================================================
        // CHECK PDF
        // ==================================================

        if (!req.file) {

            return res.send(`
                <script>
                    alert('कृपया PDF फाईल निवडा.');
                    window.history.back();
                </script>
            `);

        }


        // ==================================================
        // CHECK CATEGORY
        // ==================================================

        if (
            !category ||
            ![
                'daily',
                'weekly',
                'monthly'
            ].includes(category)
        ) {

            if (
                fs.existsSync(
                    req.file.path
                )
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            return res.send(`
                <script>
                    alert('कृपया योग्य Category निवडा.');
                    window.history.back();
                </script>
            `);

        }


        try {

            const pdfPath =
                '/uploads/' +
                req.file.filename;


            const uploadTime =
                Date.now();


            // ==================================================
            // INSERT INTO MYSQL
            // ==================================================

            await db.execute(

                `
                INSERT INTO epapers
                (
                    category,
                    pdf_path,
                    editor,
                    mobile,
                    year,
                    issue,
                    date_mr,
                    date_en,
                    rni,
                    price,
                    pages,
                    upload_time
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,

                [

                    category,

                    pdfPath,

                    req.body.editor || '',

                    req.body.mobile || '',

                    req.body.year || '',

                    req.body.issue || '',

                    req.body.date_mr || '',

                    req.body.date_en || '',

                    req.body.rni || '',

                    req.body.price || '',

                    req.body.pages || '',

                    uploadTime

                ]

            );


            return res.send(`
                <script>
                    alert('पेपर यशस्वीरित्या अपलोड झाला!');
                    window.location.href = '/admin.html';
                </script>
            `);

        } catch (error) {

            console.error(
                'UPLOAD PAPER ERROR:',
                error
            );


            // ==================================================
            // Database insert failed → Delete uploaded PDF
            // ==================================================

            if (
                req.file &&
                fs.existsSync(
                    req.file.path
                )
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            return res
                .status(500)
                .send(
                    'पेपर database मध्ये सेव्ह करताना एरर आली.'
                );

        }

    }
);


// ======================================================
// DELETE PAPER
// ======================================================
//
// Existing frontend category + index वापरू शकतो.
// पण database मध्ये actual ID वापरून delete केला जातो.
// ======================================================

app.post(
    '/delete-paper',

    checkAdmin,

    async (req, res) => {

        const category =
            req.body.category;

        const index =
            parseInt(
                req.body.index,
                10
            );


        if (
            !category ||
            ![
                'daily',
                'weekly',
                'monthly'
            ].includes(category) ||
            isNaN(index)
        ) {

            return res.send(`
                <script>
                    alert('चुकीची माहिती.');
                    window.history.back();
                </script>
            `);

        }


        try {

            // ==================================================
            // Get paper in same order as frontend
            // ==================================================

            const [
                rows
            ] = await db.execute(

                `
                SELECT
                    id,
                    pdf_path
                FROM epapers
                WHERE category = ?
                ORDER BY upload_time DESC, id DESC
                LIMIT ?, 1
                `,

                [
                    category,
                    index
                ]

            );


            if (
                rows.length === 0
            ) {

                return res.send(`
                    <script>
                        alert('पेपर सापडला नाही.');
                        window.history.back();
                    </script>
                `);

            }


            const paper =
                rows[0];


            // ==================================================
            // DELETE PDF FILE
            // ==================================================

            if (
                paper.pdf_path
            ) {

                const fileName =
                    path.basename(
                        paper.pdf_path
                    );


                const pdfFile =
                    path.join(
                        UPLOAD_FOLDER,
                        fileName
                    );


                if (
                    fs.existsSync(
                        pdfFile
                    )
                ) {

                    fs.unlinkSync(
                        pdfFile
                    );

                }

            }


            // ==================================================
            // DELETE MYSQL RECORD
            // ==================================================

            await db.execute(

                `
                DELETE FROM epapers
                WHERE id = ?
                `,

                [
                    paper.id
                ]

            );


            return res.send(`
                <script>
                    alert('पेपर यशस्वीरित्या Delete झाला.');
                    window.location.href = '/admin.html';
                </script>
            `);

        } catch (error) {

            console.error(
                'DELETE PAPER ERROR:',
                error
            );


            return res
                .status(500)
                .send(
                    'पेपर delete करताना database error आली.'
                );

        }

    }
);


// ======================================================
// EDIT PAPER
// ======================================================

app.post(
    '/edit-paper',

    checkAdmin,

    async (req, res) => {

        const category =
            req.body.category;

        const index =
            parseInt(
                req.body.index,
                10
            );


        if (
            !category ||
            ![
                'daily',
                'weekly',
                'monthly'
            ].includes(category) ||
            isNaN(index)
        ) {

            return res.send(`
                <script>
                    alert('चुकीची माहिती.');
                    window.history.back();
                </script>
            `);

        }


        try {

            // ==================================================
            // Find actual DB record
            // ==================================================

            const [
                rows
            ] = await db.execute(

                `
                SELECT
                    id
                FROM epapers
                WHERE category = ?
                ORDER BY upload_time DESC, id DESC
                LIMIT ?, 1
                `,

                [
                    category,
                    index
                ]

            );


            if (
                rows.length === 0
            ) {

                return res.send(`
                    <script>
                        alert('पेपर सापडला नाही.');
                        window.history.back();
                    </script>
                `);

            }


            const paperId =
                rows[0].id;


            // ==================================================
            // UPDATE MYSQL
            // ==================================================

            await db.execute(

                `
                UPDATE epapers

                SET

                    editor = ?,

                    mobile = ?,

                    year = ?,

                    issue = ?,

                    date_mr = ?,

                    date_en = ?,

                    rni = ?,

                    price = ?,

                    pages = ?

                WHERE id = ?
                `,

                [

                    req.body.editor || '',

                    req.body.mobile || '',

                    req.body.year || '',

                    req.body.issue || '',

                    req.body.date_mr || '',

                    req.body.date_en || '',

                    req.body.rni || '',

                    req.body.price || '',

                    req.body.pages || '',

                    paperId

                ]

            );


            return res.send(`
                <script>
                    alert('पेपरची माहिती यशस्वीरित्या Update झाली.');
                    window.location.href = '/admin.html';
                </script>
            `);

        } catch (error) {

            console.error(
                'EDIT PAPER ERROR:',
                error
            );


            return res
                .status(500)
                .send(
                    'पेपरची माहिती Update करताना database error आली.'
                );

        }

    }
);


// ======================================================
// CHANGE ADMIN PASSWORD
// ======================================================

app.post(
    '/change-password',

    checkAdmin,

    async (req, res) => {

        const oldPassword =
            req.body.old_password;

        const newPassword =
            req.body.new_password;


        if (
            !oldPassword ||
            !newPassword
        ) {

            return res.send(`
                <script>
                    alert('जुना आणि नवीन पासवर्ड दोन्ही भरा.');
                    window.history.back();
                </script>
            `);

        }


        if (
            newPassword.length < 4
        ) {

            return res.send(`
                <script>
                    alert('नवीन पासवर्ड कमीत कमी 4 characters असावा.');
                    window.history.back();
                </script>
            `);

        }


        try {

            // ==================================================
            // Get current admin
            // ==================================================

            const [
                rows
            ] = await db.execute(

                `
                SELECT
                    id,
                    password
                FROM admin_users
                WHERE id = ?
                LIMIT 1
                `,

                [
                    req.session.adminId
                ]

            );


            if (
                rows.length === 0
            ) {

                return res.send(`
                    <script>
                        alert('Admin user सापडला नाही.');
                        window.history.back();
                    </script>
                `);

            }


            const admin =
                rows[0];


            // ==================================================
            // Check old password
            // ==================================================

            if (
                oldPassword !==
                admin.password
            ) {

                return res.send(`
                    <script>
                        alert('जुना पासवर्ड चुकीचा आहे!');
                        window.history.back();
                    </script>
                `);

            }


            // ==================================================
            // Update password
            // ==================================================

            await db.execute(

                `
                UPDATE admin_users
                SET password = ?
                WHERE id = ?
                `,

                [
                    newPassword,
                    admin.id
                ]

            );


            return res.send(`
                <script>
                    alert('पासवर्ड यशस्वीरित्या बदलला आहे!');
                    window.location.href = '/admin-panel';
                </script>
            `);

        } catch (error) {

            console.error(
                'CHANGE PASSWORD ERROR:',
                error
            );


            return res
                .status(500)
                .send(
                    'पासवर्ड update करताना database error आली.'
                );

        }

    }
);


// ======================================================
// ADMIN LOGOUT
// ======================================================

app.get(
    '/logout',
    (req, res) => {

        req.session.destroy(
            (err) => {

                if (err) {

                    console.error(
                        'Logout Error:',
                        err
                    );

                    return res
                        .status(500)
                        .send(
                            'Logout failed'
                        );

                }


                res.clearCookie(
                    'connect.sid'
                );


                return res.redirect(
                    '/admin-login.html'
                );

            }
        );

    }
);


// ======================================================
// MULTER / GENERAL ERROR HANDLER
// ======================================================
app.use(
    (err, req, res, next) => {

        // ==================================================
        // PDF TYPE ERROR
        // ==================================================

        if (
            err &&
            err.message ===
                'फक्त PDF फाईल अपलोड करा.'
        ) {

            return res.send(`
                <script>
                    alert('फक्त PDF फाईल अपलोड करा.');
                    window.history.back();
                </script>
            `);

        }


        // ==================================================
        // PDF SIZE ERROR
        // ==================================================

        if (
            err &&
            err.code === 'LIMIT_FILE_SIZE'
        ) {

            return res.send(`
                <script>
                    alert('PDF फाईलचा आकार 50 MB पेक्षा जास्त असू शकत नाही.');
                    window.history.back();
                </script>
            `);

        }


        // ==================================================
        // GENERAL SERVER ERROR
        // ==================================================

        console.error(
            'SERVER ERROR:',
            err
        );


        return res
            .status(500)
            .send(
                'Server मध्ये error आली.'
            );

    }
);
// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    await testDatabaseConnection();


    app.listen(
        PORT,
        () => {

            console.log(
                `सर्व्हर चालू आहे: http://localhost:${PORT}`
            );

            console.log(
                'MySQL E-paper Backend Ready.'
            );

        }
    );

}


startServer();
