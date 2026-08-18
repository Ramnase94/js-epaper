const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = 3000;


// ======================================================
// PATHS
// ======================================================

const PUBLIC_FOLDER = path.join(__dirname, 'public');
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
const DATA_FOLDER = path.join(__dirname, 'upload');
const DATA_FILE = path.join(DATA_FOLDER, 'paper_info.json');


// ======================================================
// CREATE REQUIRED FOLDERS
// ======================================================

if (!fs.existsSync(UPLOAD_FOLDER)) {
    fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}


// ======================================================
// CREATE paper_info.json IF NOT EXISTS
// ======================================================

if (!fs.existsSync(DATA_FILE)) {

    const defaultData = {
        username: 'admin',
        password: '1234',
        daily: [],
        weekly: [],
        monthly: []
    };

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultData, null, 2),
        'utf8'
    );
}


// ======================================================
// CHECK / FIX paper_info.json
// ======================================================

try {

    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8')
    );

    let changed = false;

    if (!data.username) {
        data.username = 'admin';
        changed = true;
    }

    if (!data.password) {
        data.password = '1234';
        changed = true;
    }

    if (!Array.isArray(data.daily)) {
        data.daily = [];
        changed = true;
    }

    if (!Array.isArray(data.weekly)) {
        data.weekly = [];
        changed = true;
    }

    if (!Array.isArray(data.monthly)) {
        data.monthly = [];
        changed = true;
    }

    if (changed) {

        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2),
            'utf8'
        );

    }

} catch (error) {

    console.log(
        'paper_info.json मध्ये समस्या आहे.'
    );

}


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

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

        secret: 'lokbharti-epaper-secret-2026',

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            maxAge: 60 * 60 * 1000
        }

    })
);


// ======================================================
// ADMIN CHECK MIDDLEWARE
// ======================================================

function checkAdmin(req, res, next) {

    if (
        req.session &&
        req.session.isAdmin === true
    ) {
        return next();
    }

    return res.redirect('/admin-login.html');
}


// ======================================================
// PROTECT admin.html
// ======================================================

app.use(
    (req, res, next) => {

        if (
            req.path === '/admin.html' &&
            (!req.session ||
             req.session.isAdmin !== true)
        ) {

            return res.redirect(
                '/admin-login.html'
            );

        }

        next();

    }
);


// ======================================================
// STATIC PUBLIC FILES
// ======================================================

app.use(
    express.static(PUBLIC_FOLDER)
);


// ======================================================
// PDF FILES
// ======================================================

app.use(
    '/uploads',
    express.static(UPLOAD_FOLDER)
);


// ======================================================
// MULTER STORAGE
// ======================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            UPLOAD_FOLDER
        );

    },

    filename: (req, file, cb) => {

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


const upload = multer({

    storage: storage,

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
// 1. GET PAPER INFORMATION
// ======================================================

app.get(
    '/get-paper-info',
    (req, res) => {

        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .json({
                            success: false,
                            message:
                                'डेटाबेस वाचताना एरर आली.'
                        });

                }

                try {

                    const json =
                        JSON.parse(data);

                    return res.json(json);

                } catch (error) {

                    return res
                        .status(500)
                        .json({
                            success: false,
                            message:
                                'paper_info.json मध्ये चुकीचा डेटा आहे.'
                        });

                }

            }
        );

    }
);


// ======================================================
// 2. ADMIN LOGIN
// ======================================================

app.post(
    '/admin-login',
    (req, res) => {

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


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                'डेटाबेस वाचता आला नाही.'

                        });

                }


                try {

                    const json =
                        JSON.parse(data);


                    if (
                        username === json.username &&
                        password === json.password
                    ) {

                        req.session.isAdmin =
                            true;

                        req.session.username =
                            username;


                        return res.json({

                            success: true,

                            message:
                                'Login यशस्वी!'

                        });

                    }


                    return res.json({

                        success: false,

                        message:
                            'Username किंवा Password चुकीचा आहे.'

                    });


                } catch (error) {

                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                'paper_info.json चुकीचा आहे.'

                        });

                }

            }
        );

    }
);


// ======================================================
// 3. ADMIN PANEL
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
// 4. UPLOAD NEW E-PAPER
// ======================================================

app.post(
    '/upload-paper',

    checkAdmin,

    upload.single('epaper_pdf'),

    (req, res) => {

        const category =
            req.body.category;


        if (!req.file) {

            return res.send(`
                <script>
                    alert('कृपया PDF फाईल निवडा.');
                    window.history.back();
                </script>
            `);

        }


        if (
            !category ||
            ![
                'daily',
                'weekly',
                'monthly'
            ].includes(category)
        ) {

            if (
                fs.existsSync(req.file.path)
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


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    if (
                        fs.existsSync(req.file.path)
                    ) {
                        fs.unlinkSync(
                            req.file.path
                        );
                    }

                    return res
                        .status(500)
                        .send(
                            'पेपर डेटा वाचताना एरर आली.'
                        );

                }


                let json;

                try {

                    json =
                        JSON.parse(data);

                } catch (error) {

                    if (
                        fs.existsSync(req.file.path)
                    ) {
                        fs.unlinkSync(
                            req.file.path
                        );
                    }

                    return res
                        .status(500)
                        .send(
                            'paper_info.json चुकीचा आहे.'
                        );

                }


                if (
                    !Array.isArray(
                        json[category]
                    )
                ) {

                    json[category] = [];

                }


                const newPaper = {

                    pdfPath:
                        '/uploads/' +
                        req.file.filename,

                    editor:
                        req.body.editor || '',

                    mobile:
                        req.body.mobile || '',

                    year:
                        req.body.year || '',

                    issue:
                        req.body.issue || '',

                    date_mr:
                        req.body.date_mr || '',

                    date_en:
                        req.body.date_en || '',

                    rni:
                        req.body.rni || '',

                    price:
                        req.body.price || '',

                    pages:
                        req.body.pages || '',

                    uploadTime:
                        Date.now()

                };


                // नवीन अंक सर्वात वर
                json[category].unshift(
                    newPaper
                );


                fs.writeFile(
                    DATA_FILE,

                    JSON.stringify(
                        json,
                        null,
                        2
                    ),

                    'utf8',

                    (writeErr) => {

                        if (writeErr) {

                            if (
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
                                    'डेटा सेव्ह करताना एरर आली.'
                                );

                        }


                        return res.send(`
                            <script>
                                alert('पेपर यशस्वीरित्या अपलोड झाला!');
                                window.location.href = '/admin.html';
                            </script>
                        `);

                    }
                );

            }
        );

    }
);


// ======================================================
// 5. DELETE PAPER
// ======================================================

app.post(
    '/delete-paper',

    checkAdmin,

    (req, res) => {

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


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .send(
                            'पेपर डेटा वाचताना एरर आली.'
                        );

                }


                let json;

                try {

                    json =
                        JSON.parse(data);

                } catch (error) {

                    return res
                        .status(500)
                        .send(
                            'paper_info.json चुकीचा आहे.'
                        );

                }


                if (
                    !Array.isArray(
                        json[category]
                    ) ||
                    !json[category][index]
                ) {

                    return res.send(`
                        <script>
                            alert('पेपर सापडला नाही.');
                            window.history.back();
                        </script>
                    `);

                }


                const paper =
                    json[category][index];


                // PDF DELETE
                if (paper.pdfPath) {

                    const fileName =
                        path.basename(
                            paper.pdfPath
                        );

                    const pdfFile =
                        path.join(
                            UPLOAD_FOLDER,
                            fileName
                        );


                    if (
                        fs.existsSync(pdfFile)
                    ) {

                        fs.unlinkSync(
                            pdfFile
                        );

                    }

                }


                // JSON मधून delete
                json[category].splice(
                    index,
                    1
                );


                fs.writeFile(
                    DATA_FILE,

                    JSON.stringify(
                        json,
                        null,
                        2
                    ),

                    'utf8',

                    (writeErr) => {

                        if (writeErr) {

                            return res
                                .status(500)
                                .send(
                                    'पेपर delete करताना डेटा सेव्ह होऊ शकला नाही.'
                                );

                        }


                        return res.send(`
                            <script>
                                alert('पेपर यशस्वीरित्या Delete झाला.');
                                window.location.href = '/admin.html';
                            </script>
                        `);

                    }
                );

            }
        );

    }
);


// ======================================================
// 6. EDIT PAPER
// ======================================================

app.post(
    '/edit-paper',

    checkAdmin,

    (req, res) => {

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


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .send(
                            'पेपर डेटा वाचताना एरर आली.'
                        );

                }


                let json;

                try {

                    json =
                        JSON.parse(data);

                } catch (error) {

                    return res
                        .status(500)
                        .send(
                            'paper_info.json चुकीचा आहे.'
                        );

                }


                if (
                    !Array.isArray(
                        json[category]
                    ) ||
                    !json[category][index]
                ) {

                    return res.send(`
                        <script>
                            alert('पेपर सापडला नाही.');
                            window.history.back();
                        </script>
                    `);

                }


                const paper =
                    json[category][index];


                // माहिती UPDATE
                paper.editor =
                    req.body.editor || '';

                paper.mobile =
                    req.body.mobile || '';

                paper.year =
                    req.body.year || '';

                paper.issue =
                    req.body.issue || '';

                paper.date_mr =
                    req.body.date_mr || '';

                paper.date_en =
                    req.body.date_en || '';

                paper.rni =
                    req.body.rni || '';

                paper.price =
                    req.body.price || '';

                paper.pages =
                    req.body.pages || '';


                // PDF path ला हात लावायचा नाही.


                fs.writeFile(
                    DATA_FILE,

                    JSON.stringify(
                        json,
                        null,
                        2
                    ),

                    'utf8',

                    (writeErr) => {

                        if (writeErr) {

                            console.error(
                                'EDIT PAPER SAVE ERROR:',
                                writeErr
                            );

                            return res
                                .status(500)
                                .send(
                                    'पेपरची माहिती सेव्ह करता आली नाही.'
                                );

                        }


                        return res.send(`
                            <script>
                                alert('पेपरची माहिती यशस्वीरित्या Update झाली.');
                                window.location.href = '/admin.html';
                            </script>
                        `);

                    }
                );

            }
        );

    }
);


// ======================================================
// 7. CHANGE USERNAME + PASSWORD
// ======================================================

app.post(
    '/change-admin-details',

    checkAdmin,

    (req, res) => {

        const newUsername =
            req.body.new_username;

        const newPassword =
            req.body.new_password;


        if (
            !newUsername ||
            !newPassword
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        'Username आणि Password दोन्ही भरा.'

                });

        }


        if (
            newUsername.length < 3
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        'Username कमीत कमी 3 characters असावा.'

                });

        }


        if (
            newPassword.length < 4
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        'Password कमीत कमी 4 characters असावा.'

                });

        }


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                'डेटाबेस वाचता आला नाही.'

                        });

                }


                try {

                    const json =
                        JSON.parse(data);


                    json.username =
                        newUsername;

                    json.password =
                        newPassword;


                    fs.writeFile(
                        DATA_FILE,

                        JSON.stringify(
                            json,
                            null,
                            2
                        ),

                        'utf8',

                        (writeErr) => {

                            if (writeErr) {

                                return res
                                    .status(500)
                                    .json({

                                        success: false,

                                        message:
                                            'Details save करता आले नाहीत.'

                                    });

                            }


                            req.session.username =
                                newUsername;


                            return res.json({

                                success: true,

                                message:
                                    'Username आणि Password यशस्वीरित्या बदलले!'

                            });

                        }
                    );


                } catch (error) {

                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                'paper_info.json मध्ये error आहे.'

                        });

                }

            }
        );

    }
);


// ======================================================
// 8. OLD CHANGE PASSWORD API
// ======================================================

app.post(
    '/change-password',

    checkAdmin,

    (req, res) => {

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


        fs.readFile(
            DATA_FILE,
            'utf8',
            (err, data) => {

                if (err) {

                    return res
                        .status(500)
                        .send(
                            'डेटा वाचताना एरर आली.'
                        );

                }


                try {

                    const json =
                        JSON.parse(data);


                    if (
                        oldPassword !==
                        json.password
                    ) {

                        return res.send(`
                            <script>
                                alert('जुना पासवर्ड चुकीचा आहे!');
                                window.history.back();
                            </script>
                        `);

                    }


                    json.password =
                        newPassword;


                    fs.writeFile(
                        DATA_FILE,

                        JSON.stringify(
                            json,
                            null,
                            2
                        ),

                        'utf8',

                        (writeErr) => {

                            if (writeErr) {

                                return res
                                    .status(500)
                                    .send(
                                        'पासवर्ड अपडेट करताना एरर आली.'
                                    );

                            }


                            return res.send(`
                                <script>
                                    alert('पासवर्ड यशस्वीरित्या बदलला आहे!');
                                    window.location.href = '/admin-panel';
                                </script>
                            `);

                        }
                    );


                } catch (error) {

                    return res
                        .status(500)
                        .send(
                            'paper_info.json चुकीचा आहे.'
                        );

                }

            }
        );

    }
);


// ======================================================
// 9. LOGOUT
// ======================================================

app.get(
    '/admin-logout',
    (req, res) => {

        req.session.destroy(
            (err) => {

                return res.redirect('/');

            }
        );

    }
);


// ======================================================
// MULTER ERROR HANDLER
// ======================================================

app.use(
    (err, req, res, next) => {

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
// SERVER START
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `सर्व्हर सुरू झाला आहे: http://localhost:${PORT}`
        );

    }
);