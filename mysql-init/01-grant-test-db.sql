-- MySQL公式イメージのMYSQL_USER/MYSQL_PASSWORDは、MYSQL_DATABASEで指定したDBにしか
-- 権限を付与しない。Djangoのテストランナー（pytest-django/manage.py test）は
-- 実DBとは別に`test_<DB名>`という一時DBを作成・削除するため、そちらにも権限が要る。
GRANT ALL PRIVILEGES ON `test\_%`.* TO 'pen_and_palette'@'%';
FLUSH PRIVILEGES;
