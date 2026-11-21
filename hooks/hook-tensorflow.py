from _pyinstaller_hooks_contrib.compat import importlib_metadata
from packaging.version import Version

from PyInstaller.compat import is_linux
from PyInstaller.utils.hooks import (
    collect_data_files,
    collect_dynamic_libs,
    get_module_attribute,
    is_module_satisfies,
    logger,
)

_CANDIDATE_DIST_NAMES = (
    "tensorflow",
    "tensorflow-cpu",
    "tensorflow-gpu",
    "tensorflow-intel",
    "tensorflow-rocm",
    "tensorflow-macos",
    "tensorflow-aarch64",
    "tensorflow-cpu-aws",
    "tf-nightly",
    "tf-nightly-cpu",
    "tf-nightly-gpu",
    "tf-nightly-rocm",
    "intel-tensorflow",
    "intel-tensorflow-avx512",
)

dist = None
for candidate_dist_name in _CANDIDATE_DIST_NAMES:
    try:
        dist = importlib_metadata.distribution(candidate_dist_name)
        break
    except importlib_metadata.PackageNotFoundError:
        continue

version = None
if dist is None:
    logger.warning(
        "hook-tensorflow: failed to determine tensorflow dist name! Reading version from tensorflow.__version__!"
    )
    try:
        version = get_module_attribute("tensorflow", "__version__")
    except Exception as e:
        raise Exception("Failed to read tensorflow.__version__") from e
else:
    logger.info("hook-tensorflow: tensorflow dist name: %s", dist.name)
    version = dist.version

try:
    version = Version(version)
except Exception as e:
    raise Exception("Failed to parse tensorflow version!") from e

# Exclude development and runtime files from the collected TensorFlow data.
data_excludes = [
    "include",
    "xla_aot_runtime_src",
    "libtensorflow_framework.*",
    "libtensorflow_cc.*",
    "**/*.lib",
]

if is_module_satisfies("PyInstaller >= 6.0"):
    excluded_submodules = []
else:
    excluded_submodules = ["tensorflow.python._pywrap_tensorflow_internal"]

hiddenimports = []
datas = collect_data_files("tensorflow", excludes=data_excludes)

if version >= Version("2.14.0"):
    hiddenimports += ["ml_dtypes"]

binaries = []
excludedimports = excluded_submodules
warn_on_missing_hiddenimports = False
module_collection_mode = {
    "tensorflow.python.autograph": "py+pyz",
}

if is_linux:
    bindepend_symlink_suppression = [
        "**/libtensorflow_cc.so*",
        "**/libtensorflow_framework.so*",
        "**/_pywrap_tensorflow_internal.so",
    ]
    hiddenimports += ["tensorflow-plugins"]
    binaries += collect_dynamic_libs("tensorflow-plugins")
